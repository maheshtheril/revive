'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { AccountingService } from '@/lib/services/accounting'
import { hms_purchase_status, hms_receipt_status } from "@prisma/client"
import crypto from 'crypto'
import { isUUID } from '@/lib/utils'

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
                    // If tax info exists in line, use it
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

    // Validate Date
    const receiptDate = new Date(data.receivedDate);
    if (isNaN(receiptDate.getTime())) {
        return { error: "Invalid invoice date format. Please use YYYY-MM-DD or DD-MM-YYYY." };
    }

    // Validate sale price for all items
    for (const item of data.items) {
        if (!item.salePrice || item.salePrice <= 0) {
            return { error: "Sale price is required for all items and must be greater than 0." };
        }
        if (item.mrp && item.salePrice > item.mrp) {
            return { error: `Sale price (${item.salePrice}) cannot be greater than MRP (${item.mrp}).` };
        }
        if (item.unitPrice && item.salePrice < item.unitPrice) {
            return { error: `Sale price (${item.salePrice}) cannot be less than net cost/unit price (${item.unitPrice}).` };
        }
    }

    try {
        if (data.reference) {
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

            if (existing && !isOpening) {
                return { error: `Duplicate: Invoice '${data.reference}' has already been recorded for this supplier in the last 60 days.` };
            }
        }

        let finalSupplierId = data.supplierId;
        if (isOpening && !finalSupplierId) {
            const systemSupplier = await prisma.hms_supplier.findFirst({
                where: { company_id: companyId, name: "SYSTEM: Opening Balance" }
            });
            if (systemSupplier) {
                finalSupplierId = systemSupplier.id;
            } else {
                const newSupplier = await prisma.hms_supplier.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        name: "SYSTEM: Opening Balance",
                        metadata: { is_system: true, notes: "Automated supplier for opening balance entries" }
                    }
                });
                finalSupplierId = newSupplier.id;
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const count = await tx.hms_purchase_receipt.count({ where: { company_id: companyId } })
            const receiptNumber = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

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

            let defaultLocation = await tx.hms_stock_location.findFirst({
                where: { company_id: companyId, name: 'Main Warehouse' }
            });

            if (!defaultLocation) {
                defaultLocation = await tx.hms_stock_location.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId!,
                        company_id: companyId!,
                        name: 'Main Warehouse',
                        code: 'WH-MAIN',
                        location_type: 'warehouse'
                    }
                });
            }

            const productIds = Array.from(new Set(data.items.map(i => i.productId)));
            const batchNos = Array.from(new Set(data.items.map(i => i.batch).filter(Boolean)));

            const [existingProducts, existingBatches, taxMaps] = await Promise.all([
                tx.hms_product.findMany({ where: { id: { in: productIds } }, select: { id: true, metadata: true, price: true } }),
                tx.hms_product_batch.findMany({
                    where: {
                        company_id: companyId,
                        product_id: { in: productIds },
                        batch_no: { in: batchNos as string[] }
                    }
                }),
                tx.company_tax_maps.findMany({
                    where: { company_id: companyId },
                    include: { tax_rates: true }
                })
            ]);

            const productMap = new Map(existingProducts.map(p => [p.id, p]));
            const batchMap = new Map(existingBatches.map(b => [`${b.product_id}|${b.batch_no}`, b.id]));
            const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);

            const newBatchesToCreate: any[] = [];
            const seenNewBatches = new Set<string>();

            for (const item of data.items) {
                if (!item.productId || !item.batch) continue;
                const key = `${item.productId}|${item.batch}`;
                if (!batchMap.has(key) && !seenNewBatches.has(key)) {
                    let validExpiry = null;
                    if (item.expiry) {
                        const d = new Date(item.expiry);
                        if (!isNaN(d.getTime())) validExpiry = d;
                    }

                    const conversionForNewBatch = Number(item.conversionFactor) || 1;
                    const newId = crypto.randomUUID();
                    newBatchesToCreate.push({
                        id: newId,
                        tenant_id: session.user.tenantId!,
                        company_id: companyId!,
                        product_id: item.productId,
                        batch_no: item.batch,
                        expiry_date: validExpiry,
                        mrp: (item.mrp || 0) / conversionForNewBatch,
                        cost: (item.unitPrice || 0) / conversionForNewBatch,
                        sale_price: (item.salePrice || 0) / conversionForNewBatch,
                        margin_percentage: item.marginPct || 0,
                        markup_percentage: item.markupPct || 0,
                        pricing_strategy: item.pricingStrategy || 'manual',
                        qty_on_hand: 0
                    });
                    seenNewBatches.add(key);
                    batchMap.set(key, newId);
                }
            }

            if (newBatchesToCreate.length > 0) {
                await tx.hms_product_batch.createMany({ data: newBatchesToCreate });
            }

            const receiptLinesData: any[] = [];
            const productUpdates: Map<string, any> = new Map();

            for (const item of data.items) {
                let resolvedTaxId = (item as any).taxId || null;
                if (!resolvedTaxId && item.taxRate) {
                    const match = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate));
                    if (match) resolvedTaxId = match.id;
                }

                let batchId = batchMap.get(`${item.productId}|${item.batch}`) || null;
                const billedQty = Number(item.qtyReceived) || 0;
                const freeQty = Number(item.freeQty) || 0;
                const totalQty = billedQty + freeQty;

                receiptLinesData.push({
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId!,
                    company_id: companyId!,
                    receipt_id: receipt.id,
                    product_id: item.productId,
                    po_line_id: item.poLineId || null,
                    qty: billedQty,
                    unit_price: Number(item.unitPrice) || 0,
                    batch_id: batchId || null,
                    location_id: defaultLocation!.id,
                    metadata: {
                        batch: item.batch,
                        expiry: item.expiry,
                        mrp: item.mrp,
                        sale_price: item.salePrice,
                        margin_pct: item.marginPct,
                        markup_pct: item.markupPct,
                        pricing_strategy: item.pricingStrategy,
                        mrp_discount_pct: item.mrpDiscountPct,
                        tax: { id: resolvedTaxId, rate: item.taxRate || 0, amount: item.taxAmount || 0 },
                        hsn: item.hsn,
                        packing: item.packing,
                        purchase_uom: item.purchaseUOM,
                        base_uom: item.baseUOM,
                        conversion_factor: item.conversionFactor,
                        sale_price_per_unit: item.salePricePerUnit,
                        discount_pct: item.discountPct,
                        discount_amt: item.discountAmt,
                        scheme_discount: item.schemeDiscount,
                        free_qty: freeQty
                    },
                    created_at: new Date()
                });

                let effectiveConversion = Number(item.conversionFactor) || 1;
                const effectiveUOM = (item.purchaseUOM || 'PCS').toUpperCase().trim();
                const packMatch = effectiveUOM.match(/(\d+)/);
                if (effectiveConversion === 1 && packMatch) {
                    effectiveConversion = parseInt(packMatch[1]);
                }

                const stockQty = totalQty * effectiveConversion;
                const avgCostPerBaseUnit = billedQty > 0 ? (billedQty * (Number(item.unitPrice) || 0)) / stockQty : 0;

                if (item.taxRate || item.salePrice) {
                    const salePricePerPCS = item.salePrice && effectiveConversion > 1 ? item.salePrice / effectiveConversion : item.salePrice;
                    const mrpPerPCS = item.mrp && effectiveConversion > 1 ? item.mrp / effectiveConversion : (item.mrp || 0);

                    productUpdates.set(item.productId, {
                        price: salePricePerPCS,
                        mrp: mrpPerPCS,
                        pricingStrategy: item.pricingStrategy || 'manual',
                        default_cost: avgCostPerBaseUnit,
                        taxId: resolvedTaxId,
                        taxRate: item.taxRate,
                        uomData: {
                            base_uom: 'PCS',
                            base_price: salePricePerPCS,
                            conversion_factor: effectiveConversion,
                            pack_uom: effectiveUOM,
                            pack_price: item.salePrice,
                            pack_mrp: item.mrp || 0
                        }
                    });
                }
            }

            if (receiptLinesData.length > 0) {
                await tx.hms_purchase_receipt_line.createMany({ data: receiptLinesData });

                for (let i = 0; i < receiptLinesData.length; i++) {
                    const line = receiptLinesData[i];
                    const itemPayload = data.items[i];
                    const billedQty = Number(line.qty) || 0;
                    const freeQty = Number((line.metadata as any)?.free_qty) || 0;
                    const totalQty = billedQty + freeQty;
                    let effectiveConversion = itemPayload.conversionFactor || 1;
                    const stockQty = totalQty * effectiveConversion;

                    const stockWhere = {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: line.product_id,
                        location_id: line.location_id,
                        batch_id: line.batch_id
                    };

                    const existingLevel = await tx.hms_stock_levels.findFirst({ where: stockWhere });
                    if (existingLevel) {
                        await tx.hms_stock_levels.update({ where: { id: existingLevel.id }, data: { quantity: { increment: stockQty } } });
                    } else {
                        await tx.hms_stock_levels.create({ data: { ...stockWhere, id: crypto.randomUUID(), quantity: stockQty, reserved: 0 } });
                    }

                    if (line.batch_id) {
                        const unitCost = billedQty > 0 ? (billedQty * Number(line.unit_price)) / stockQty : 0;
                        const unitMRP = totalQty > 0 ? (totalQty * (Number(itemPayload.mrp) || 0)) / stockQty : (Number(itemPayload.mrp) || 0);
                        const unitSalePrice = totalQty > 0 ? (totalQty * (Number(itemPayload.salePrice) || 0)) / stockQty : (Number(itemPayload.salePrice) || 0);

                        await tx.hms_product_batch.update({
                            where: { id: line.batch_id },
                            data: { qty_on_hand: { increment: stockQty }, cost: unitCost, mrp: unitMRP, sale_price: unitSalePrice }
                        });
                    }

                    await tx.hms_stock_ledger.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: line.product_id,
                            movement_type: 'in',
                            qty: stockQty,
                            uom: (line.metadata as any)?.base_uom || 'PCS',
                            unit_cost: billedQty > 0 ? (billedQty * Number(line.unit_price)) / stockQty : 0,
                            total_cost: billedQty * Number(line.unit_price),
                            to_location_id: line.location_id,
                            batch_id: line.batch_id,
                            reference: receipt.name,
                            related_type: 'hms_purchase_receipt',
                            related_id: receipt.id
                        }
                    });

                    await tx.hms_stock_move.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: line.product_id,
                            location_to: line.location_id,
                            qty: stockQty,
                            uom: (line.metadata as any)?.base_uom || 'PCS',
                            move_type: 'in' as any,
                            source: 'Purchase Receipt',
                            source_reference: receipt.id,
                            cost: line.unit_price,
                            created_by: session.user.id
                        }
                    });
                }
            }

            for (const [productId, update] of productUpdates) {
                const currentProduct = productMap.get(productId);
                await tx.hms_product.update({
                    where: { id: productId },
                    data: {
                        price: update.price || currentProduct?.price,
                        default_cost: update.default_cost,
                        metadata: {
                            ...(currentProduct?.metadata as any || {}),
                            purchase_tax_id: update.taxId,
                            purchase_tax_rate: update.taxRate,
                            tax_id: update.taxId,
                            tax_rate: update.taxRate,
                            tax: { id: update.taxId, rate: update.taxRate },
                            last_purchase_date: new Date().toISOString(),
                            last_mrp: update.mrp,
                            last_sale_price: update.price,
                            pricing_strategy: update.pricingStrategy,
                            uom_data: update.uomData
                        }
                    }
                });
            }

            if (data.purchaseOrderId) {
                await tx.hms_purchase_order.update({
                    where: { id: data.purchaseOrderId },
                    data: { status: 'partially_received' as any }
                });
            }

            let invoiceSubtotal = 0;
            let invoiceTaxTotal = 0;
            const invoiceLinesData = data.items.map(item => {
                const qty = Number(item.qtyReceived) || 0;
                const price = Number(item.unitPrice) || 0;
                const tax = Number(item.taxAmount) || 0;
                const discount = (Number(item.discountAmt) || 0) + (Number(item.schemeDiscount) || 0);
                const taxable = (qty * price) - discount;
                invoiceSubtotal += taxable;
                invoiceTaxTotal += tax;
                const lineResolvedTaxId = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate))?.id || null;
                return {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId!,
                    company_id: companyId!,
                    product_id: item.productId,
                    description: "Auto-created from Receipt",
                    qty: qty,
                    unit_price: price,
                    tax: { id: lineResolvedTaxId, rate: item.taxRate, amount: tax },
                    line_total: taxable + tax
                };
            });

            const newInvoice = await tx.hms_purchase_invoice.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId!,
                    company_id: companyId!,
                    supplier_id: data.supplierId,
                    purchase_order_id: data.purchaseOrderId,
                    name: data.reference || receiptNumber.replace('GRN', 'BILL'),
                    invoice_date: receiptDate,
                    due_date: receiptDate,
                    status: 'posted',
                    currency: session.user.currencyCode || "INR",
                    subtotal: invoiceSubtotal,
                    tax_total: invoiceTaxTotal,
                    total_amount: invoiceSubtotal + invoiceTaxTotal,
                    paid_amount: 0,
                    metadata: { source_receipt_id: receipt.id, notes: data.notes }
                }
            });

            if (invoiceLinesData.length > 0) {
                await tx.hms_purchase_invoice_line.createMany({
                    data: invoiceLinesData.map(l => ({ ...l, invoice_id: newInvoice.id }))
                });
            }

            if (data.attachmentUrl) {
                await tx.hms_purchase_receipt.update({
                    where: { id: receipt.id },
                    data: { metadata: { ...(receipt.metadata as any || {}), attachment_url: data.attachmentUrl } }
                });
            }

            return { receipt, invoiceId: newInvoice.id };
        }, { timeout: 30000, maxWait: 10000 })

        if (result.invoiceId) {
            await AccountingService.postPurchaseInvoice(result.invoiceId, session.user.id);
        }

        revalidatePath('/hms/purchasing/receipts');
        revalidatePath('/hms/accounting/bills');
        revalidatePath('/hms/inventory/reports/stock');

        const returnData = JSON.parse(JSON.stringify(result.receipt));
        if (returnData.metadata?.attachment_url) returnData.metadata.attachment_url = "EXCLUDED_FOR_PERFORMANCE";
        return { success: true, data: returnData };

    } catch (error: any) {
        console.error("Failed to process receipt:", error);
        return { error: error.message || "Failed to process receipt" }
    }
}

export async function getPurchaseReceipts() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const receipts = await prisma.hms_purchase_receipt.findMany({
            where: { company_id: session.user.companyId },
            include: { hms_supplier: { select: { name: true } }, hms_purchase_receipt_line: true },
            orderBy: { created_at: 'desc' }
        });

        return {
            success: true,
            data: receipts.map(r => {
                const totalAmount = r.hms_purchase_receipt_line.reduce((sum, line) => {
                    const meta = line.metadata as any || {};
                    const taxAmount = meta.tax?.amount ?? meta.tax_amount ?? 0;
                    return sum + (Number(line.qty || 0) * Number(line.unit_price || 0)) + Number(taxAmount);
                }, 0);

                return {
                    id: r.id,
                    number: r.name,
                    date: r.receipt_date,
                    supplierName: r.hms_supplier?.name || "Unknown",
                    reference: (r.metadata as any)?.reference || 'N/A',
                    itemCount: r.hms_purchase_receipt_line.length,
                    totalAmount: Number(totalAmount.toFixed(2)),
                    status: r.status
                };
            })
        };
    } catch (error) {
        console.error("Failed to fetch receipts:", error);
        return { error: "Failed to load receipts." };
    }
}

export async function getPurchaseReceipt(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        if (!id || id.length < 10) return { error: "Invalid Receipt ID" };

        const receipt = await prisma.hms_purchase_receipt.findUnique({
            where: { id, company_id: session.user.companyId },
            include: { hms_supplier: true, hms_purchase_receipt_line: true }
        });

        if (!receipt) return { error: "Receipt not found" };

        const productIds = receipt.hms_purchase_receipt_line.map(line => line.product_id).filter(Boolean);
        const products = await prisma.hms_product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true }
        });
        const productMap = new Map(products.map(p => [p.id, p.name]));

        const safeNum = (val: any) => {
            if (val === null || val === undefined) return 0;
            const n = Number(val);
            return isNaN(n) ? 0 : n;
        };

        const mappedData = {
            id: receipt.id,
            number: receipt.name,
            date: receipt.receipt_date,
            supplierId: receipt.supplier_id,
            supplierName: receipt.hms_supplier?.name || "Unknown",
            purchaseOrderId: receipt.purchase_order_id,
            reference: (receipt.metadata as any)?.reference || '',
            notes: (receipt.metadata as any)?.notes || '',
            attachmentUrl: (receipt.metadata as any)?.attachment_url || '',
            items: receipt.hms_purchase_receipt_line.map(line => {
                const meta = line.metadata as any || {};
                return {
                    id: line.id,
                    productId: line.product_id,
                    productName: productMap.get(line.product_id) || "Unknown",
                    qty: safeNum(line.qty),
                    receivedQty: safeNum(line.qty),
                    unitPrice: safeNum(line.unit_price),
                    batch: meta.batch || '',
                    batchId: line.batch_id,
                    expiry: meta.expiry || '',
                    mrp: safeNum(meta.mrp),
                    salePrice: safeNum(meta.sale_price),
                    marginPct: safeNum(meta.margin_pct),
                    markupPct: safeNum(meta.markup_pct),
                    pricingStrategy: meta.pricing_strategy || 'manual',
                    mrpDiscountPct: safeNum(meta.mrp_discount_pct),
                    packing: meta.packing || '',
                    purchaseUOM: meta.purchase_uom || '',
                    baseUOM: meta.base_uom || 'PCS',
                    conversionFactor: safeNum(meta.conversion_factor || 1),
                    salePricePerUnit: safeNum(meta.sale_price_per_unit),
                    taxRate: safeNum(meta.tax?.rate ?? meta.tax_rate ?? 0),
                    taxAmount: safeNum(meta.tax?.amount ?? meta.tax_amount ?? 0),
                    hsn: meta.hsn || '',
                    discountPct: safeNum(meta.discount_pct),
                    discountAmt: safeNum(meta.discount_amt),
                    schemeDiscount: safeNum(meta.scheme_discount),
                    freeQty: safeNum(meta.free_qty)
                };
            })
        };

        return { success: true, data: JSON.parse(JSON.stringify(mappedData)) };
    } catch (error: any) {
        console.error("Error in getPurchaseReceipt:", error);
        return { error: `Load Error: ${error.message}` };
    }
}

export async function updatePurchaseReceipt(id: string, data: PurchaseReceiptData) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    for (const item of data.items) {
        if (!item.salePrice || item.salePrice <= 0) return { error: "Sale price is required." };
        if (item.mrp && item.salePrice > item.mrp) return { error: "Sale price cannot exceed MRP." };
    }

    try {
        await prisma.hms_purchase_receipt.update({
            where: { id, company_id: session.user.companyId },
            data: {
                supplier_id: data.supplierId,
                receipt_date: data.receivedDate,
                metadata: { reference: data.reference, notes: data.notes, attachment_url: data.attachmentUrl }
            }
        });

        const taxMaps = await prisma.company_tax_maps.findMany({
            where: { company_id: session.user.companyId },
            include: { tax_rates: true }
        });
        const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);

        for (const item of data.items) {
            let resolvedTaxId = (item as any).taxId || null;
            if (!resolvedTaxId && item.taxRate) {
                resolvedTaxId = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate))?.id || null;
            }

            if ((item as any).id) {
                const line = await prisma.hms_purchase_receipt_line.update({
                    where: { id: (item as any).id },
                    data: {
                        unit_price: item.unitPrice,
                        metadata: {
                            batch: item.batch,
                            expiry: item.expiry,
                            mrp: item.mrp,
                            sale_price: item.salePrice,
                            margin_pct: item.marginPct,
                            markup_pct: item.markupPct,
                            pricing_strategy: item.pricingStrategy,
                            mrp_discount_pct: item.mrpDiscountPct,
                            tax: { id: resolvedTaxId, rate: item.taxRate || 0, amount: item.taxAmount || 0 },
                            hsn: item.hsn,
                            packing: item.packing,
                            purchase_uom: item.purchaseUOM,
                            base_uom: item.baseUOM,
                            conversion_factor: item.conversionFactor,
                            sale_price_per_unit: item.salePricePerUnit,
                            discount_pct: item.discountPct,
                            discount_amt: item.discountAmt,
                            scheme_discount: item.schemeDiscount,
                            free_qty: item.freeQty
                        }
                    }
                });

                if (line.batch_id) {
                    const billedQty = Number(item.qtyReceived) || 0;
                    const freeQty = Number(item.freeQty) || 0;
                    const conversion = Number(item.conversionFactor) || 1;
                    const totalUnits = (billedQty + freeQty) * conversion;

                    if (totalUnits > 0) {
                        const unitCost = billedQty > 0 ? (billedQty * Number(item.unitPrice)) / totalUnits : 0;
                        const unitMRP = (Number(item.mrp) || 0) / conversion;
                        const unitSalePrice = (Number(item.salePrice) || 0) / conversion;

                        await prisma.hms_product_batch.update({
                            where: { id: line.batch_id },
                            data: { cost: unitCost, mrp: unitMRP, sale_price: unitSalePrice }
                        });
                    }
                }

                if (item.productId && item.taxRate) {
                    const currentProduct = await prisma.hms_product.findUnique({ where: { id: item.productId }, select: { metadata: true } });
                    await prisma.hms_product.update({
                        where: { id: item.productId },
                        data: {
                            metadata: {
                                ...(currentProduct?.metadata as any || {}),
                                purchase_tax_id: resolvedTaxId,
                                purchase_tax_rate: item.taxRate,
                                tax: { id: resolvedTaxId, rate: item.taxRate },
                                last_purchase_date: new Date().toISOString()
                            }
                        }
                    });
                }
            }
        }

        revalidatePath('/hms/purchasing/receipts');
        revalidatePath('/hms/inventory/reports/stock');
        return { success: true };
    } catch (error) {
        console.error("Failed to update receipt:", error);
        return { error: "Failed to update receipt." };
    }
}

// --- WORLD CLASS ADMIN CONTROLS: DELETE RECEIPT & REVERSE STOCK ---
/**
 * Deletes a purchase receipt and reverses all stock impacts.
 * ONLY available to Admin roles.
 */
export async function deletePurchaseReceipt(receiptId: string) {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'admin') {
        throw new Error("UNAUTHORIZED: Only administrators can delete purchase records.");
    }

    const companyId = session.user.companyId;
    if (!isUUID(receiptId)) throw new Error("Invalid Receipt ID");

    return await prisma.$transaction(async (tx) => {
        // [TYPES-FIX] Using 'as any' for receipt to access relation lines without strict prisma-generated include error
        const receipt = await tx.hms_purchase_receipt.findUnique({
            where: { id: receiptId, company_id: companyId! },
            include: { hms_purchase_receipt_line: true }
        }) as any;

        if (!receipt) throw new Error("Receipt not found.");

        for (const line of receipt.hms_purchase_receipt_line) {
            const qtyToReverse = Number(line.qty) || 0;
            if (qtyToReverse === 0) continue;

            if (line.batch_id) {
                await tx.hms_product_batch.update({
                    where: { id: line.batch_id },
                    data: { qty_on_hand: { decrement: qtyToReverse } }
                });

                const targetLocId = line.location_id || (await tx.hms_stock_location.findFirst({ where: { company_id: companyId! } }))?.id;
                if (targetLocId) {
                    await tx.hms_stock_levels.updateMany({
                        where: { product_id: line.product_id, batch_id: line.batch_id, location_id: targetLocId },
                        data: { quantity: { decrement: qtyToReverse } }
                    });
                }
            }
        }

        const poId = receipt.purchase_order_id;
        if (poId) {
            const invoices = await tx.hms_purchase_invoice.findMany({ where: { purchase_order_id: poId, company_id: companyId! } });
            for (const inv of invoices) {
                // --- FINANCIAL INTEGRITY GUARD: BLOCK IF PAID ---
                const paidAmt = Number(inv.paid_amount) || 0;
                if (paidAmt > 0) {
                    throw new Error(`FINANCIAL BLOCK: Cannot delete purchase. Payment of ${paidAmt} has already been recorded against bill ${inv.name}. You must void/delete the payment record first.`);
                }

                // i. Delete Journal Lines that belong to any entry for this invoice
                await tx.journal_entry_lines.deleteMany({
                    where: { journal_entries: { purchase_invoice_id: inv.id } }
                });

                // ii. Delete Journal Entries
                await tx.journal_entries.deleteMany({
                    where: { purchase_invoice_id: inv.id }
                });
                await tx.hms_purchase_invoice_line.deleteMany({ where: { invoice_id: inv.id } });
                await tx.hms_purchase_invoice.delete({ where: { id: inv.id } });
            }
        }

        await tx.hms_purchase_receipt_line.deleteMany({ where: { receipt_id: receiptId } });
        await tx.hms_purchase_receipt.delete({ where: { id: receiptId } });

        revalidatePath('/hms/inventory/reports/stock');
        revalidatePath('/hms/purchasing/receipts');
        return { success: true };
    });
}
