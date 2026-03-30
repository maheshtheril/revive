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
        // 1. Sale price is required
        if (!item.salePrice || item.salePrice <= 0) {
            return { error: "Sale price is required for all items and must be greater than 0." };
        }

        // 2. Sale price should not be greater than MRP
        if (item.mrp && item.salePrice > item.mrp) {
            return { error: `Sale price (${item.salePrice}) cannot be greater than MRP (${item.mrp}).` };
        }

        // 3. Sale price should not be less than net cost (unit price)
        if (item.unitPrice && item.salePrice < item.unitPrice) {
            return { error: `Sale price (${item.salePrice}) cannot be less than net cost/unit price (${item.unitPrice}).` };
        }
    }

    if (data.attachmentUrl && data.attachmentUrl.startsWith('data:')) {
        console.log(`📎 ATTACHMENT DETECTED: Base64 string, size: ${(data.attachmentUrl.length / 1024 / 1024).toFixed(2)} MB`);
    }
    console.log("createPurchaseReceipt payload size check:", JSON.stringify(data).length, "bytes");

    try {
        // 0. CHECK FOR DUPLICATES (Supplier + Reference)
        if (data.reference) {
            // Check for duplicates within last 60 days to prevent re-entering same invoice
            const sixtydaysAgo = new Date();
            sixtydaysAgo.setDate(sixtydaysAgo.getDate() - 60);

            const existing = await prisma.hms_purchase_receipt.findFirst({
                where: {
                    company_id: session.user.companyId,
                    supplier_id: data.supplierId,
                    metadata: {
                        path: ['reference'],
                        equals: data.reference
                    },
                    created_at: { gte: sixtydaysAgo }
                }
            });

            if (existing && !isOpening) {
                return { error: `Duplicate: Invoice '${data.reference}' has already been recorded for this supplier in the last 60 days.` };
            }
        }

        // If it's opening stock, we might need a dummy supplier or just let it be null 
        // depending on the schema. hms_purchase_receipt.supplier_id is usually nullable?
        // Let's check or create a system supplier if needed.
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
            // 1. Generate Receipt Number
            const count = await tx.hms_purchase_receipt.count({ where: { company_id: companyId } })
            const receiptNumber = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

            console.log(`[Receipt] Starting transaction for ${receiptNumber}`);
            // 2. Create Receipt Header
            const receipt = await tx.hms_purchase_receipt.create({
                data: {
                    id: crypto.randomUUID(), // Explicit ID Generation
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
                        // attachment_url deferred to end of transaction to speed up initial insert
                    },
                }
            })

            // 2b. ensure default location exists for stock
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

            // --- BATCH FETCHING TO SOLVE N+1 ---
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
            // Key format: productId|batchNo
            const batchMap = new Map(existingBatches.map(b => [`${b.product_id}|${b.batch_no}`, b.id]));
            const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);

            const receiptLinesData: any[] = [];
            const productUpdates: Map<string, any> = new Map();

            // --- 2c. PRE-CREATE MISSING BATCHES IN BULK ---
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

                    const newId = crypto.randomUUID();
                    newBatchesToCreate.push({
                        id: newId,
                        tenant_id: session.user.tenantId!,
                        company_id: companyId!,
                        product_id: item.productId,
                        batch_no: item.batch,
                        expiry_date: validExpiry,
                        mrp: item.mrp || 0,
                        cost: item.unitPrice || 0,
                        sale_price: item.salePrice || 0,
                        margin_percentage: item.marginPct || 0,
                        markup_percentage: item.markupPct || 0,
                        pricing_strategy: item.pricingStrategy || 'manual',
                        qty_on_hand: 0
                    });
                    seenNewBatches.add(key);
                    batchMap.set(key, newId); // Reserve in map so lines can use it
                }
            }

            if (newBatchesToCreate.length > 0) {
                await tx.hms_product_batch.createMany({ data: newBatchesToCreate });
            }

            for (const item of data.items) {
                if (!item.productId) throw new Error("Product ID is missing for one or more items.");

                // Resolve Tax ID from Rate
                let resolvedTaxId = (item as any).taxId || null;
                if (!resolvedTaxId && item.taxRate) {
                    const match = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate));
                    if (match) resolvedTaxId = match.id;
                }

                // Handle Batch (Use pre-fetched map - now includes newly created ones)
                let batchId = batchMap.get(`${item.productId}|${item.batch}`) || null;

                const billedQty = Number(item.qtyReceived) || 0;
                const freeQty = Number(item.freeQty) || 0;
                const totalQty = billedQty + freeQty;

                // A. Prepare Receipt Line Data
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

                let effectiveConversion = item.conversionFactor || 1;
                const effectiveUOM = (item.purchaseUOM || 'PCS').toUpperCase();

                // Simple pack detection logic
                if (effectiveConversion === 1 && effectiveUOM !== 'PCS') {
                    const packMatch = effectiveUOM.match(/(?:PACK|BOX|STRIP|TRAY)-(\d+)/i) || effectiveUOM.match(/^(\d+)(?:'S|S|X\d+|X)?$/i);
                    if (packMatch) effectiveConversion = parseInt(packMatch[1]);
                    else if (effectiveUOM === 'STRIP') effectiveConversion = 10;
                }

                const stockQty = totalQty * effectiveConversion;
                const avgCostPerBaseUnit = billedQty > 0 ? (billedQty * (Number(item.unitPrice) || 0)) / stockQty : 0;

                // C. Prepare Product Update Data (if needed)
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
            }            // Execute Batch Receipt Line Inserts
            if (receiptLinesData.length > 0) {
                // We use createMany which is faster and still triggers Postgres AFTER INSERT per row
                await tx.hms_purchase_receipt_line.createMany({ data: receiptLinesData });

                // --- WORLD CLASS STOCK INTEGRATION ---
                // Every item in the receipt should now update Stock Levels and Stock History
                for (let i = 0; i < receiptLinesData.length; i++) {
                    const line = receiptLinesData[i];
                    const itemPayload = data.items[i]; // 1-to-1 mapping guaranteed
                    
                    if (!itemPayload) {
                        console.error("[Receipt] CRITICAL: itemPayload missing for line", i);
                        continue;
                    }

                    const billedQty = Number(line.qty) || 0;
                    const freeQty = Number((line.metadata as any)?.free_qty) || 0;
                    const totalQty = billedQty + freeQty;

                    // Calculate Stock Units (handling packs)
                    let effectiveConversion = itemPayload.conversionFactor || 1;
                    const stockQty = totalQty * effectiveConversion;

                    // 1. Update Stock Levels (Upsert)
                    const stockWhere = {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: line.product_id,
                        location_id: line.location_id,
                        batch_id: line.batch_id
                    };

                    const existingLevel = await tx.hms_stock_levels.findFirst({ where: stockWhere });

                    if (existingLevel) {
                        await tx.hms_stock_levels.update({
                            where: { id: existingLevel.id },
                            data: { quantity: { increment: stockQty } }
                        });
                    } else {
                        await tx.hms_stock_levels.create({
                            data: {
                                ...stockWhere,
                                id: crypto.randomUUID(),
                                quantity: stockQty,
                                reserved: 0
                            }
                        });
                    }

                    // 2. Log to Stock Ledger (History)
                    await tx.hms_stock_ledger.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: line.product_id,
                            movement_type: 'in',
                            qty: stockQty,
                            uom: (line.metadata as any)?.base_uom || 'PCS',
                            unit_cost: billedQty > 0 ? (billedQty * line.unit_price) / stockQty : 0,
                            total_cost: billedQty * line.unit_price,
                            to_location_id: line.location_id,
                            batch_id: line.batch_id,
                            reference: receipt.name,
                            related_type: 'hms_purchase_receipt',
                            related_id: receipt.id
                        }
                    });

                    // 3. Log to Stock Move (Audit Trail)
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

            // Execute Batch Product Updates (Optimized via pre-fetched map)
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
                            tax_id: update.taxId, // Explicit for billing
                            tax_rate: update.taxRate, // Explicit for billing
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

            // 4. Update PO Status if linked
            if (data.purchaseOrderId) {
                await tx.hms_purchase_order.update({
                    where: { id: data.purchaseOrderId },
                    data: { status: 'partially_received' as any }
                });
            }

            // 6. AUTO-CREATE PURCHASE INVOICE
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

            // 7. Update Attachment at the very end (if large, this minimizes lock time on header during the loop)
            if (data.attachmentUrl) {
                await tx.hms_purchase_receipt.update({
                    where: { id: receipt.id },
                    data: {
                        metadata: {
                            ...(receipt.metadata as any || {}),
                            attachment_url: data.attachmentUrl
                        }
                    }
                });
            }

            return { receipt, invoiceId: newInvoice.id };
        }, { timeout: 30000, maxWait: 10000 })


        if (result.invoiceId) {
            // Trigger Accounting Post via INVOICE (Correct Workflow for AP)
            // This books: Dr Purchase Expense, Dr Input Tax, Cr Accounts Payable
            const accResult = await AccountingService.postPurchaseInvoice(result.invoiceId, session.user.id);

            if (!accResult.success) {
                console.error("Accounting Post Failed (Invoice):", accResult.error);
                const warningData = JSON.parse(JSON.stringify(result.receipt));
                if (warningData.metadata?.attachment_url) warningData.metadata.attachment_url = "EXCLUDED_FOR_PERFORMANCE";
                return { success: true, data: warningData, warning: `Receipt & Bill created, but Accounting failed: ${accResult.error}` };
            }
        }

        revalidatePath('/hms/purchasing/receipts');
        revalidatePath('/hms/accounting/bills');

        // STRATEGY: Strip large attachment from return data to prevent serialization hangs
        const returnData = JSON.parse(JSON.stringify(result.receipt));
        if (returnData.metadata?.attachment_url) {
            returnData.metadata.attachment_url = "EXCLUDED_FOR_PERFORMANCE"; // Client already has it
        }

        return { success: true, data: returnData };

    } catch (error: any) {
        console.error("Failed to create receipt (Full Error):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return { error: error.message || "Failed to process receipt" }
    }
}

export async function getPurchaseReceipts() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const receipts = await prisma.hms_purchase_receipt.findMany({
            where: {
                company_id: session.user.companyId
            },
            include: {
                hms_supplier: {
                    select: { name: true }
                },
                hms_purchase_receipt_line: true
            },
            orderBy: { created_at: 'desc' }
        });

        return {
            success: true,
            data: receipts.map(r => {
                const totalAmount = r.hms_purchase_receipt_line.reduce((sum, line) => {
                    const meta = line.metadata as any || {};
                    const taxAmount = meta.tax?.amount ?? meta.tax_amount ?? 0;
                    const lineTotal = (Number(line.qty || 0) * Number(line.unit_price || 0)) + Number(taxAmount);
                    return sum + lineTotal;
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
    console.log("getPurchaseReceipt called with ID:", id);
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        if (!id || id.length < 10) return { error: "Invalid Receipt ID" };

        // 1. Fetch Receipt & Lines (NO nested product include)
        const receipt = await prisma.hms_purchase_receipt.findUnique({
            where: {
                id,
                company_id: session.user.companyId
            },
            include: {
                hms_supplier: true,
                hms_purchase_receipt_line: true
            }
        });

        console.log("getPurchaseReceipt DB Result:", receipt ? "Found" : "Not Found");

        if (!receipt) return { error: `Receipt not found for ID: ${id}` };

        // 2. Fetch Products manually to avoid missing relation issues
        const productIds = receipt.hms_purchase_receipt_line
            .map(line => line.product_id)
            .filter(Boolean); // Filter nulls if any

        const products = await prisma.hms_product.findMany({
            where: {
                id: { in: productIds }
            },
            select: { id: true, name: true }
        });

        const productMap = new Map(products.map(p => [p.id, p.name]));

        // Helper for safe numbers (handles Decimal, null, undefined)
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
            hms_supplier: receipt.hms_supplier,
            reference: (receipt.metadata as any)?.reference || '',
            notes: (receipt.metadata as any)?.notes || '',
            attachmentUrl: (receipt.metadata as any)?.attachment_url || (receipt.metadata as any)?.attachmentUrl || '',
            items: receipt.hms_purchase_receipt_line.map(line => {
                const meta = line.metadata as any || {};
                // Handle nested tax object or flat keys for backward compatibility
                const taxRate = meta.tax?.rate ?? meta.tax_rate ?? 0;
                const taxAmount = meta.tax?.amount ?? meta.tax_amount ?? 0;

                return {
                    id: line.id,
                    productId: line.product_id,
                    productName: productMap.get(line.product_id) || "Unknown",
                    qty: safeNum(line.qty),
                    receivedQty: safeNum(line.qty), // UI often uses receivedQty
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
                    pack: meta.packing || meta.purchase_uom || '',
                    uom: meta.purchase_uom || meta.packing || '',
                    taxRate: safeNum(taxRate),
                    taxAmount: safeNum(taxAmount),
                    hsn: meta.hsn || '',
                    discountPct: safeNum(meta.discount_pct),
                    discountAmt: safeNum(meta.discount_amt),
                    schemeDiscount: safeNum(meta.scheme_discount),
                    freeQty: safeNum(meta.free_qty),
                    conversionFactor: safeNum(meta.conversion_factor || 1)
                };
            })
        };

        // Aggressive serialization
        return { success: true, data: JSON.parse(JSON.stringify(mappedData)) };

    } catch (error: any) {
        console.error("Critical Error in getPurchaseReceipt:", error);
        return { error: `Load Error: ${error.message}` };
    }
}

export async function updatePurchaseReceipt(id: string, data: PurchaseReceiptData) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    // Validate sale price for all items
    for (const item of data.items) {
        // 1. Sale price is required
        if (!item.salePrice || item.salePrice <= 0) {
            return { error: "Sale price is required for all items and must be greater than 0." };
        }

        // 2. Sale price should not be greater than MRP
        if (item.mrp && item.salePrice > item.mrp) {
            return { error: `Sale price (${item.salePrice}) cannot be greater than MRP (${item.mrp}).` };
        }

        // 3. Sale price should not be less than net cost (unit price)
        if (item.unitPrice && item.salePrice < item.unitPrice) {
            return { error: `Sale price (${item.salePrice}) cannot be less than net cost/unit price (${item.unitPrice}).` };
        }
    }

    try {
        await prisma.hms_purchase_receipt.update({
            where: { id, company_id: session.user.companyId },
            data: {
                supplier_id: data.supplierId,
                receipt_date: data.receivedDate,
                metadata: {
                    reference: data.reference,
                    notes: data.notes,
                    attachment_url: data.attachmentUrl
                }
            }
        });

        // Fetch company tax rates to resolve IDs for metadata
        const taxMaps = await prisma.company_tax_maps.findMany({
            where: { company_id: session.user.companyId },
            include: { tax_rates: true }
        });
        const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);

        for (const item of data.items) {
            // Resolve Tax ID from Rate
            let resolvedTaxId = (item as any).taxId || null;
            if (!resolvedTaxId && item.taxRate) {
                const match = companyTaxRates.find(tr => Number(tr.rate) === Number(item.taxRate));
                if (match) resolvedTaxId = match.id;
            }

            if ((item as any).id) {
                await prisma.hms_purchase_receipt_line.update({
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
                            tax: {
                                id: resolvedTaxId,
                                rate: item.taxRate || 0,
                                amount: item.taxAmount || 0
                            },
                            hsn: item.hsn,
                            packing: item.packing,
                            // UOM data
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

                // Update Product Tax Rate (GST Compliance: Sale tax = Purchase tax)
                if (item.productId && item.taxRate) {
                    const currentProduct = await prisma.hms_product.findUnique({
                        where: { id: item.productId },
                        select: { metadata: true }
                    });

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
        return { success: true };
    } catch (error) {
        console.error("Failed to update receipt:", error);
        return { error: "Failed to update receipt." };
    }
}
