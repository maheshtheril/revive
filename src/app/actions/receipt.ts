'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { AccountingService } from '@/lib/services/accounting'
import { hms_purchase_status, hms_receipt_status } from "@prisma/client"
import crypto from 'crypto'

export type PurchaseReceiptData = {
    supplierId?: string
    purchaseOrderId?: string | null
    receivedDate: Date
    reference?: string
    notes?: string
    attachmentUrl?: string
    isOpening?: boolean
    items: {
        productId: string
        poLineId?: string
        qtyReceived: number
        unitPrice?: number
        locationId?: string
        batch?: string
        expiry?: string
        mrp?: number
        salePrice?: number           // Sale price for this batch
        marginPct?: number            // Profit margin percentage
        markupPct?: number            // Markup percentage on cost
        pricingStrategy?: string      // How the price was set
        mrpDiscountPct?: number       // Discount % from MRP (e.g., 10 for MRP-10%)
        taxRate?: number
        taxAmount?: number
        hsn?: string
        packing?: string
        // UOM Pack/Unit Support
        purchaseUOM?: string          // UOM used for purchase (e.g., "Strip")
        baseUOM?: string              // Product's base UOM (e.g., "Unit")
        conversionFactor?: number     // Conversion factor (e.g., 1 Strip = 15 Units)
        salePricePerUnit?: number     // Sale price for base UOM (calculated)
        discountPct?: number
        discountAmt?: number
        schemeDiscount?: number
        freeQty?: number
    }[]
}

export async function getPendingPurchaseOrders() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pos = await prisma.hms_purchase_order.findMany({
        where: {
            company_id: session.user.companyId,
            status: { in: ['approved', 'partially_received'] as any }
        },
        include: {
            hms_supplier: true
        }
    });

    return {
        data: pos.map(po => ({
            id: po.id,
            poNumber: po.name,
            supplierName: po.hms_supplier?.name || "Unknown"
        }))
    };
}

export async function getPurchaseOrder(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const po = await prisma.hms_purchase_order.findUnique({
        where: { id },
        include: {
            hms_supplier: true,
            hms_purchase_order_line: {
                include: {
                    hms_product: true
                }
            }
        }
    });

    if (!po) return { error: "PO not found" };

    const supplierMeta = po.hms_supplier?.metadata as Record<string, any> || {};

    return {
        data: {
            id: po.id,
            supplierId: po.supplier_id,
            supplierName: po.hms_supplier?.name || "Unknown",
            supplierGstin: supplierMeta.gstin || supplierMeta.GSTIN || undefined,
            items: po.hms_purchase_order_line.map(line => {
                const lineMeta = line.metadata as Record<string, any> || {};
                const productMeta = line.hms_product?.metadata as Record<string, any> || {};

                const ordered = Number(line.qty);
                const received = Number(line.received_qty || 0);
                const pending = Math.max(0, ordered - received);

                return {
                    poLineId: line.id,
                    productId: line.product_id,
                    productName: line.hms_product?.name || "Unknown Product",
                    orderedQty: ordered,
                    receivedQty: 0,
                    pendingQty: pending,
                    unitPrice: Number(line.unit_price),
                    taxRate: lineMeta.tax_rate || productMeta.taxRate || productMeta.tax_rate || 0,
                    hsn: lineMeta.hsn || productMeta.hsn || "",
                    packing: lineMeta.packing || productMeta.packing || ""
                };
            })
        }
    };
}

export async function createPurchaseReceipt(data: PurchaseReceiptData) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized: Missing Company or Tenant ID. Please relogin." }
    const companyId = session.user.companyId;
    const isOpening = data.isOpening || data.reference === 'OPENING-STOCK';

    if (!isOpening && !data.supplierId) return { error: "Supplier is required." }
    if (!data.items || data.items.length === 0) return { error: "Receipt must have items" }

    const receiptDate = new Date(data.receivedDate);
    if (isNaN(receiptDate.getTime())) {
        return { error: "Invalid invoice date format." };
    }

    try {
        if (data.reference && !isOpening) {
            const sixtydaysAgo = new Date();
            sixtydaysAgo.setDate(sixtydaysAgo.getDate() - 60);

            const existing = await prisma.hms_purchase_receipt.findFirst({
                where: {
                    company_id: session.user.companyId,
                    supplier_id: data.supplierId,
                    metadata: { path: ['reference'], equals: data.reference },
                    created_at: { gte: sixtydaysAgo }
                }
            });

            if (existing) return { error: `Duplicate: Invoice '${data.reference}' already recorded.` };
        }

        let finalSupplierId = data.supplierId;
        if (isOpening && !finalSupplierId) {
            const systemSupplier = await prisma.hms_supplier.findFirst({
                where: { company_id: companyId, name: "SYSTEM: Opening Balance" }
            }) || await prisma.hms_supplier.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: companyId,
                    name: "SYSTEM: Opening Balance",
                    metadata: { is_system: true }
                }
            });
            finalSupplierId = systemSupplier.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            const count = await tx.hms_purchase_receipt.count({ where: { company_id: companyId } })
            const nextCount = count + 1;
            const year = new Date().getFullYear();
            const receiptNumber = `GRN-${year}-${nextCount.toString().padStart(4, '0')}`;

            const receipt = await tx.hms_purchase_receipt.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId!,
                    company_id: companyId!,
                    purchase_order_id: data.purchaseOrderId,
                    supplier_id: finalSupplierId,
                    name: receiptNumber,
                    received_by: session.user.id,
                    receipt_date: receiptDate,
                    status: 'received' as any,
                    metadata: {
                        reference: data.reference,
                        notes: data.notes,
                        is_opening: data.isOpening
                    },
                }
            })

            const defaultLocation = await tx.hms_stock_location.findFirst({
                where: { company_id: companyId }
            }) || await tx.hms_stock_location.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId!,
                    company_id: companyId!,
                    name: 'Main Warehouse',
                    code: 'WH-MAIN',
                    location_type: 'warehouse'
                }
            });

            const productIds = Array.from(new Set(data.items.map(i => i.productId)));
            const taxMaps = await tx.company_tax_maps.findMany({
                where: { company_id: companyId },
                include: { tax_rates: true }
            });
            const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);
            const products = await tx.hms_product.findMany({ where: { id: { in: productIds } } });
            const productMap = new Map(products.map(p => [p.id, p]));

            for (const item of data.items) {
                const billedQty = Number(item.qtyReceived) || 0;
                const freeQty = Number(item.freeQty) || 0;
                const totalQty = billedQty + freeQty;
                
                let resolvedTaxId = (item as any).taxId || null;
                if (!resolvedTaxId && item.taxRate) {
                    const match = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate));
                    if (match) resolvedTaxId = match.id;
                }

                const currentProduct = productMap.get(item.productId);
                let effectiveConversion = item.conversionFactor || 1;
                const stockQty = (billedQty + freeQty) * effectiveConversion;
                
                // --- ACTUAL LANDED COST MATH ---
                const billedValue = billedQty * (item.unitPrice || 0);
                const discountValue = (item.discountAmt || 0) + (item.schemeDiscount || 0);
                const taxValue = item.taxAmount || 0;
                const landedLineTotal = (billedValue - discountValue) + taxValue;
                const landedCostPerBaseUnit = stockQty > 0 ? landedLineTotal / stockQty : (item.unitPrice || 0);

                // Batch creation logic
                let batchId = null;
                if (item.batch) {
                    const existingBatch = await tx.hms_product_batch.findFirst({
                        where: { product_id: item.productId, batch_no: item.batch, company_id: companyId }
                    });
                    if (existingBatch) {
                        batchId = existingBatch.id;
                        // Update cost if it changed (Landed Cost)
                        await tx.hms_product_batch.update({
                            where: { id: batchId },
                            data: {
                                cost: landedCostPerBaseUnit,
                                mrp: item.mrp || 0,
                                sale_price: item.salePrice || 0,
                            }
                        });
                    } else {
                        batchId = crypto.randomUUID();
                        await tx.hms_product_batch.create({
                            data: {
                                id: batchId,
                                tenant_id: session.user.tenantId!,
                                company_id: companyId,
                                product_id: item.productId,
                                batch_no: item.batch,
                                expiry_date: item.expiry ? new Date(item.expiry) : null,
                                mrp: item.mrp || 0,
                                cost: landedCostPerBaseUnit, // SAVE LANDED COST HERE
                                sale_price: item.salePrice || 0,
                                qty_on_hand: totalQty
                            }
                        });
                    }
                }

                await tx.hms_purchase_receipt_line.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        receipt_id: receipt.id,
                        product_id: item.productId,
                        qty: billedQty,
                        unit_price: item.unitPrice || 0,
                        batch_id: batchId,
                        location_id: defaultLocation.id,
                        metadata: { ...item, landed_cost: landedCostPerBaseUnit }
                    }
                });

                // Update Stock Levels
                const stockWhere = { company_id: companyId, product_id: item.productId, location_id: defaultLocation.id, batch_id: batchId };
                const existingLevel = await tx.hms_stock_levels.findFirst({ where: stockWhere });
                if (existingLevel) {
                    await tx.hms_stock_levels.update({ where: { id: existingLevel.id }, data: { quantity: { increment: stockQty } } });
                } else {
                    await tx.hms_stock_levels.create({ data: { ...stockWhere, tenant_id: session.user.tenantId!, id: crypto.randomUUID(), quantity: stockQty } });
                }

                // Log Ledger
                await tx.hms_stock_ledger.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'in',
                        qty: stockQty,
                        unit_cost: landedCostPerBaseUnit,
                        total_cost: landedLineTotal,
                        reference: receipt.name,
                        related_id: receipt.id
                    }
                });

                // Update Product Master
                await tx.hms_product.update({
                    where: { id: item.productId },
                    data: {
                        default_cost: landedCostPerBaseUnit,
                        price: item.salePrice && effectiveConversion > 1 ? item.salePrice / effectiveConversion : (item.salePrice || currentProduct?.price || 0),
                        metadata: {
                            ...(currentProduct?.metadata as any || {}),
                            tax: { id: resolvedTaxId, rate: item.taxRate }
                        }
                    }
                });
            }

            return { receipt };
        }, { timeout: 30000 });

        revalidatePath('/hms/inventory/reports/stock');
        return { success: true, data: result.receipt };
    } catch (e: any) {
        console.error("Receipt Storage Failed:", e);
        return { error: e.message };
    }
}

export async function getPurchaseReceipts() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    try {
        const receipts = await prisma.hms_purchase_receipt.findMany({
            where: { company_id: session.user.companyId },
            include: { 
                hms_supplier: { select: { name: true } }, 
                hms_purchase_receipt_line: true 
            },
            orderBy: { created_at: 'desc' }
        });
        return { 
            success: true, 
            data: receipts.map(r => {
                const meta = r.metadata as any || {};
                return { 
                    id: r.id, 
                    number: r.name, 
                    date: r.receipt_date, 
                    supplierName: r.hms_supplier?.name || "Unknown", 
                    itemCount: r.hms_purchase_receipt_line.length, 
                    status: r.status,
                    reference: meta.reference || meta.invoice_no || "N/A",
                    totalAmount: 0 // Hidden in UI, kept for type safety
                };
            }) 
        };
    } catch (e) { return { error: "Load failed" }; }
}

export async function getPurchaseReceipt(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    try {
        const receipt = await prisma.hms_purchase_receipt.findUnique({
            where: { id, company_id: session.user.companyId },
            include: { hms_supplier: true, hms_purchase_receipt_line: true }
        });
        if (!receipt) return { error: "Not found" };
        const products = await prisma.hms_product.findMany({ where: { id: { in: receipt.hms_purchase_receipt_line.map(l => l.product_id) } } });
        const pMap = new Map(products.map(p => [p.id, p]));
        return { success: true, data: { ...receipt, items: receipt.hms_purchase_receipt_line.map(l => ({ ...l, productName: pMap.get(l.product_id)?.name || "Unknown", ...(l.metadata as any) })) } };
    } catch (e) { return { error: "Load failed" }; }
}

export async function updatePurchaseReceipt(id: string, data: PurchaseReceiptData) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    try {
        await prisma.hms_purchase_receipt.update({
            where: { id, company_id: session.user.companyId },
            data: { 
                receipt_date: data.receivedDate,
                metadata: { reference: data.reference, notes: data.notes, attachment_url: data.attachmentUrl } 
            }
        });

        for (const item of data.items) {
            const billedQty = Number(item.qtyReceived) || 0;
            const freeQty = Number(item.freeQty) || 0;
            const effectiveConversion = item.conversionFactor || 1;
            const stockQty = (billedQty + freeQty) * effectiveConversion;
            
            const billedValue = billedQty * (item.unitPrice || 0);
            const discountValue = (item.discountAmt || 0) + (item.schemeDiscount || 0);
            const landedLineTotal = (billedValue - discountValue) + (item.taxAmount || 0);
            const landedCostPerPiece = stockQty > 0 ? landedLineTotal / stockQty : (item.unitPrice || 0);

            if (item.productId) {
                await prisma.hms_product.update({
                    where: { id: item.productId },
                    data: { default_cost: landedCostPerPiece, price: item.salePrice && effectiveConversion > 1 ? item.salePrice / effectiveConversion : (item.salePrice || 0) }
                });

                // Also update the batch cost if it exists
                if (item.batch) {
                    await prisma.hms_product_batch.updateMany({
                        where: { product_id: item.productId, batch_no: item.batch, company_id: session.user.companyId },
                        data: { cost: landedCostPerPiece, sale_price: item.salePrice || 0, mrp: item.mrp || 0 }
                    });
                }
            }
        }
        revalidatePath('/hms/purchasing/receipts');
        return { success: true };
    } catch (e: any) { return { error: e.message }; }
}

export async function getNextReceiptNumber() {
    const session = await auth();
    if (!session?.user?.companyId) return "GRN-XXXX";
    try {
        const count = await prisma.hms_purchase_receipt.count({ where: { company_id: session.user.companyId } });
        return `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    } catch (e) { return "GRN-NEW"; }
}
