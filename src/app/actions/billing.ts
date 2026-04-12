'use server'

import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { AccountingService } from "@/lib/services/accounting"
import { NotificationService } from "@/lib/services/notification";
import { SYSTEM_DEFAULT_CURRENCY_CODE } from "@/lib/currency-constants";
import { isUUID, safeNum } from "@/lib/utils/is-uuid";
import { getWhatsAppConfig, getHMSSettings } from "./settings";
import { serialize } from "@/lib/utils";


export async function getUoms() {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { success: false, error: "Unauthorized" };

    try {
        const uoms = await (prisma as any).hms_uom.findMany({
            where: { tenant_id: (session?.user as any).tenantId },
            orderBy: { name: 'asc' }
        });

        // Serialize Decimal fields for Client Components
        const serializedUoms = uoms.map((u: any) => ({
            ...u,
            ratio: u.ratio?.toNumber() || 1,
            rounding: u.rounding?.toNumber() || 0.01
        }));

        return { success: true, data: serializedUoms };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getNextVoucherNumber(date: string = new Date().toISOString()) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const settings = await prisma.company_settings.findUnique({
            where: { company_id: companyId },
            select: { numbering_prefix: true }
        });
        const customPrefix = settings?.numbering_prefix || 'INV';

        const invDate = new Date(date);
        const month = invDate.getMonth();
        const year = invDate.getFullYear();

        let fyStart = year;
        let fyEnd = year + 1;
        if (month < 3) {
            fyStart = year - 1;
            fyEnd = year;
        }
        const fyString = `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
        const prefix = `${customPrefix}-${fyString}-`;

        const lastInvoice = await prisma.hms_invoice.findFirst({
            where: {
                company_id: companyId,
                invoice_number: { startsWith: prefix }
            },
            orderBy: { created_at: 'desc' },
            select: { invoice_number: true }
        });

        let nextSeq = 1;
        if (lastInvoice?.invoice_number) {
            const parts = lastInvoice.invoice_number.split('-');
            const lastSeqStr = parts[parts.length - 1];
            const lastSeq = parseInt(lastSeqStr);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }

        const invoiceNo = `${prefix}${nextSeq.toString().padStart(5, '0')}`;
        return { success: true, data: invoiceNo };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function getBillableItems() {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    const tenantId = session?.user?.tenantId;
    if (!companyId || !tenantId) return { error: "Unauthorized" };

    try {
        const items = await prisma.hms_product.findMany({
            where: {
                tenant_id: tenantId,
                company_id: companyId,
                is_active: true
            },
            select: {
                id: true,
                sku: true,
                name: true,
                description: true,
                uom: true,
                price: true,
                metadata: true,
                is_service: true,
                hms_product_price_history: {
                    orderBy: { valid_from: 'desc' },
                    take: 1,
                    select: { price: true }
                },
                hms_product_category_rel: {
                    include: {
                        hms_product_category: {
                            include: {
                                tax_rates: true
                            }
                        }
                    }
                },
                product_tax_rules: {
                    where: { is_active: true },
                    include: { tax_rates: true },
                    orderBy: { priority: 'desc' },
                    take: 1
                },
                hms_purchase_order_line: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            },
            orderBy: { updated_at: 'desc' },
            take: 2000 // [OPTIMIZATION] Limit to avoid heap/timeout issues on very large catalogs
        });

        const itemIds = items.map(i => i.id);

        // PROCUREMENT SYNC: Retrieve latest system-wide records to populate maps efficiently
        // [OPTIMIZATION] High-Performance Fetch: Only fetch THE latest 2000 records total.
        // This is much faster than fetching per-product history across the entire history.
        const [lastInvoiceEntries, lastReceiptEntries, taxMaps] = await Promise.all([
            prisma.hms_purchase_invoice_line.findMany({
                where: {
                    company_id: companyId,
                    tenant_id: tenantId,
                },
                orderBy: { created_at: 'desc' },
                take: 1500
            }),
            prisma.hms_purchase_receipt_line.findMany({
                where: {
                    company_id: companyId,
                    tenant_id: tenantId
                },
                orderBy: { created_at: 'desc' },
                take: 1500
            }),
            prisma.company_tax_maps.findMany({
                where: { company_id: companyId },
                include: { tax_rates: true }
            })
        ]);

        // [OPTIMIZATION] Create O(1) Lookups for procurement data
        const invoiceMap = new Map();
        lastInvoiceEntries.forEach(entry => {
            if (!invoiceMap.has(entry.product_id)) invoiceMap.set(entry.product_id, entry);
        });

        const receiptMap = new Map();
        lastReceiptEntries.forEach(entry => {
            if (!receiptMap.has(entry.product_id)) receiptMap.set(entry.product_id, entry);
        });

        // [OPTIMIZATION] Pre-fetch company tax rates to resolve IDs from rates if needed
        const companyTaxRates = taxMaps.map(m => m.tax_rates).filter(Boolean);
        const rateToIdMap = new Map(companyTaxRates.map(tr => [Number(tr.rate), tr.id]));
        const idToRateObjMap = new Map(companyTaxRates.map(tr => [tr.id, tr]));

        const defaultTaxId = taxMaps.find(m => m.is_default)?.tax_rate_id || null;

        const flatItems = items.map((item) => {
            const priceHistory = item.hms_product_price_history?.[0];
            const categoryRel = item.hms_product_category_rel?.[0];
            const category = categoryRel?.hms_product_category;
            const productTaxRule = item.product_tax_rules?.[0];

            // 1. Resolve newest procurement record with reliable date comparison (O(1) lookup)
            const piLine = invoiceMap.get(item.id);
            const receiptLine = receiptMap.get(item.id);
            const poLine = item.hms_purchase_order_line?.[0];

            const dateRank = [
                { rec: piLine, date: piLine?.created_at ? new Date(piLine.created_at) : null },
                { rec: receiptLine, date: receiptLine?.created_at ? new Date(receiptLine.created_at) : null },
                { rec: poLine, date: poLine?.created_at ? new Date(poLine.created_at) : null }
            ].filter(d => d.date !== null).sort((a, b) => b.date!.getTime() - a.date!.getTime());

            const latestPurchase: any = dateRank.length > 0 ? dateRank[0].rec : (piLine || receiptLine || poLine);

            let purchaseTaxId = null;
            let purchaseTaxRate = 0;

            // Robust tax extraction from the latest purchase record
            const taxSource = latestPurchase?.tax || latestPurchase?.metadata?.tax;

            if (taxSource && !(typeof taxSource === 'object' && Object.keys(taxSource).length === 0)) {
                if (typeof taxSource === 'object' && !Array.isArray(taxSource)) {
                    purchaseTaxId = taxSource.id || null;
                    purchaseTaxRate = Number(taxSource.rate || 0);
                } else if (Array.isArray(taxSource) && taxSource.length > 0) {
                    purchaseTaxId = taxSource[0].id;
                    purchaseTaxRate = Number(taxSource[0].rate || 0);
                }
            }

            // CRITICAL: If we have a purchase rate but no ID, resolve the ID from company settings
            if (!purchaseTaxId && purchaseTaxRate > 0) {
                purchaseTaxId = rateToIdMap.get(purchaseTaxRate) || null;
            }

            // FINAL TAX RESOLUTION: Specific Rule > Latest Purchase Identity > Product Metadata > Category Default
            const productMetadata = item.metadata as any || {};
            let finalTaxId = productTaxRule?.tax_rate_id ||
                purchaseTaxId ||
                productMetadata.tax_id ||
                productMetadata.tax?.id ||
                category?.default_tax_rate_id ||
                null;

            // Resolve final numerical rate using O(1) map
            let finalTaxRate = 0;
            const resolvedRateObj = finalTaxId ? idToRateObjMap.get(finalTaxId) : null;

            if (resolvedRateObj) {
                finalTaxRate = Number(resolvedRateObj.rate);
            } else {
                // 3. FALLBACK: If ID was set but not found in company map (Ghost ID), RESET it.
                // This is critical for data that might have been imported/restored with broken links.
                finalTaxId = null;

                // Resolve by rate values
                const fallbackRate = Number(productTaxRule?.tax_rates?.rate) ||
                    purchaseTaxRate ||
                    Number(productMetadata.tax_rate) ||
                    Number(productMetadata.tax?.rate) ||
                    (!item.is_service ? Number(category?.tax_rates?.rate) : 0) ||
                    0;

                if (fallbackRate > 0) {
                    finalTaxRate = fallbackRate;
                    // RE-RESOLVE ID: Find matching ID by rate in company settings (O(1) lookup)
                    finalTaxId = rateToIdMap.get(fallbackRate) || null;
                }
            }

            // SERVICE OVERRIDE: Only if NO tax is explicitly found
            // Previously we forced 0% for all services without a specific rule, which caused issues.
            // Now we trust the resolution chain (Product Rule > Purchase > Category > Default).
            if (item.is_service && !finalTaxId && !productTaxRule?.tax_rate_id) {
                // Keep as is: No tax found, so 0% is correct.
                // But do NOT clear it if finalTaxId is already set (e.g. from Category)
            }

            // Extract UOM pricing data from metadata
            const metadata = item.metadata as any || {};
            const uomData = metadata.uom_data || {};
            const pricingStrategy = metadata.pricing_strategy || 'manual';

            // PRIORITY: Strategy-based Choice > Last Sale Price > History > Base Price
            let finalPrice = priceHistory?.price?.toNumber() || Number(item.price) || 0;

            if (pricingStrategy === 'mrp' && metadata.last_mrp) {
                finalPrice = Number(metadata.last_mrp);
            } else if (metadata.last_sale_price) {
                // This covers 'manual' and 'mrp_discount' (where the intended bill price is the discounted one)
                finalPrice = Number(metadata.last_sale_price);
            } else if (metadata.last_mrp) {
                finalPrice = Number(metadata.last_mrp);
            }

            return {
                id: item.id,
                sku: item.sku || '',
                label: item.name, // UI friendly
                description: item.description || '',
                uom: item.uom || 'Unit',
                price: finalPrice,
                type: item.is_service ? 'service' : 'item',
                metadata: {
                    ...metadata,
                    // UOM Pricing (Industry Standard)
                    baseUom: uomData.base_uom || item.uom || 'PCS',
                    basePrice: finalPrice,
                    conversionFactor: uomData.conversion_factor || 1,
                    packUom: uomData.pack_uom || (uomData.conversion_factor > 1 ? `PACK-${uomData.conversion_factor}` : (item.uom || 'PCS')),
                    packPrice: uomData.pack_price || (finalPrice * (uomData.conversion_factor || 1)),
                    packSize: uomData.pack_size || uomData.conversion_factor || 1,
                    lastMrp: metadata.last_mrp,
                    lastSalePrice: metadata.last_sale_price,
                    pricingStrategy: pricingStrategy
                },
                // Extract tax for auto-suggest (prioritize rule > purchase > category)
                categoryTaxId: finalTaxId,
                categoryTaxRate: finalTaxRate
            };
        });

        return { success: true, data: serialize(flatItems) };
    } catch (error) {
        console.error("Failed to fetch billable items:", error);
        return { error: "Failed to fetch items" };
    }
}

export async function getTaxConfiguration() {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        // 1. Fetch Company Tax Maps (Primary source of truth for allowed taxes)
        const taxMaps = await prisma.company_tax_maps.findMany({
            where: {
                company_id: companyId,
                is_active: true
            },
            include: {
                tax_rates: true
            }
        });

        // 2. Map to simpler structure for the UI terminal
        const taxRates = taxMaps.map(m => ({
            id: m.tax_rate_id,
            name: m.tax_rates.name,
            rate: m.tax_rates.rate.toNumber(),
            isDefault: m.is_default
        }));

        const defaultRate = taxRates.find(t => t.isDefault) || taxRates[0];

        return {
            success: true,
            data: {
                defaultTax: defaultRate || null,
                taxRates: taxRates
            }
        };
    } catch (error) {
        console.error("Failed to fetch tax configuration:", error);
        return { error: "Failed to fetch company taxes" };
    }
}

export async function createInvoice(data: {
    patient_id: string,
    appointment_id?: string,
    date: string,
    line_items: any[],
    payments?: any[],
    status?: any,
    total_discount?: number,
    billing_metadata?: any
}) {
    const session = await auth();
    const LOG_PREFIX = `[BILLING-ENGINE-${Date.now()}]`;
    const tenantId = session?.user?.tenantId;
    const companyId = (session?.user as any).companyId || tenantId;
    const branchId = (session?.user as any).current_branch_id || (session?.user as any).branch_id;
    const userId = session?.user?.id;

    if (!tenantId || !companyId) {
        console.error(`${LOG_PREFIX} createInvoice - Unauthorized or Missing Context`, { tenantId, companyId });
        return { error: "Unauthorized or Missing Facility Context" };
    }


    console.log(`${LOG_PREFIX} [EXECUTION-TRACE] createInvoice PID: ${data.patient_id}, APT: ${data.appointment_id || 'N/A'}, Status: ${data.status || 'draft'}`);

    // [INTEGRITY-GUARD] Prevent posting if nursing items are pending confirmation
    if (data.status === 'posted' || data.status === 'paid') {
        if (data.appointment_id && isUUID(data.appointment_id)) {
            const pendingMoves = await prisma.hms_stock_move.count({
                where: {
                    source_reference: data.appointment_id,
                    source: 'Nursing Consumption (Pending)'
                }
            });
            if (pendingMoves > 0) {
                return { error: `Clinical Integrity Violation: ${pendingMoves} nursing consumables are pending confirmation. Verify and confirm items in Nursing Action Center before finalizing this bill.` };
            }
        }
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // [ATOMIC-GUARD] Use Postgres Advisory Lock to prevent concurrent creation for the same context
            const lockKeyStr = data.appointment_id || data.patient_id;
            await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${lockKeyStr}'))`);

            // 1. Resolve Patient Identity
            let resolvedPatientId: string | null = null;
            const patientInput = data.patient_id;
            const rawPatientId = (patientInput && typeof patientInput === 'object') ? (patientInput as any).id : patientInput;

            if (isUUID(rawPatientId)) {
                resolvedPatientId = rawPatientId;
            } else if (rawPatientId && rawPatientId.toString().startsWith('PAT-')) {
                const p = await tx.hms_patient.findFirst({
                    where: { tenant_id: tenantId, patient_number: rawPatientId.toString() },
                    select: { id: true }
                });
                if (p) resolvedPatientId = p.id;
            }

            // [REGISTRATION-SYNC-LOCK] If this invoice contains a registration fee, we MUST synchronize with generateRegistrationInvoice
            const hasRegFee = data.line_items?.some(l => {
                const desc = l.description?.toLowerCase() || "";
                // Nuclear Fuzzy Match: Catch any variation of Registration/Identity Fee
                return (desc.includes('reg') && desc.includes('fee')) ||
                    desc.includes('identity service') ||
                    desc.includes('registration') ||
                    desc.includes('identity fee');
            });

            if (hasRegFee && resolvedPatientId) {
                // Use the EXACT SAME lock string as generateRegistrationInvoice
                await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${resolvedPatientId}_reg'))`);
            }

            // 2. [STRICT-GUARD] Check for existing invoice AFTER acquiring lock
            if (isUUID(data.appointment_id)) {
                const existing = await tx.hms_invoice.findFirst({
                    where: {
                        appointment_id: data.appointment_id,
                        tenant_id: tenantId,
                        status: { in: ['draft', 'posted'] as any[] }
                    },
                    orderBy: { created_at: 'desc' }
                });
                if (existing) {
                    console.log(`${LOG_PREFIX} [RACE-PREVENTED] Resuming ${existing.invoice_number} instead of creating duplicate.`);
                    return { _isDuplicate: true, existingId: existing.id };
                }
            }

            if (hasRegFee && resolvedPatientId) {
                const existingReg = await tx.hms_invoice.findFirst({
                    where: {
                        patient_id: resolvedPatientId,
                        tenant_id: tenantId,
                        status: { in: ['draft', 'posted', 'paid'] as any[] },
                        hms_invoice_lines: {
                            some: {
                                OR: [
                                    { description: { contains: 'Reg', mode: 'insensitive' } },
                                    { description: { contains: 'Registration', mode: 'insensitive' } },
                                    { description: { contains: 'Identity', mode: 'insensitive' } }
                                ]
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
                });
                if (existingReg) {
                    console.log(`${LOG_PREFIX} [REG-RACE-PREVENTED] Patient ${resolvedPatientId} already has a registration invoice ${existingReg.invoice_number} (Nuclear Match).`);
                    return { _isDuplicate: true, existingId: existingReg.id };
                }
            }

            // [DEDUPLICATION-FIX] Fuzzy intra-invoice deduplication
            let processedLineItems = [...(data.line_items || [])];
            let regFound = false;
            processedLineItems = processedLineItems.filter(l => {
                const desc = l.description?.toLowerCase() || "";
                const isReg = desc.includes('registration fee') || desc.includes('identity service') || (desc.includes('registration') && desc.includes('fee'));
                if (isReg) {
                    if (regFound) return false; // Remove subsequent instances
                    regFound = true;
                    l.description = REG_FEE_DESCRIPTION; // Standardize
                    return true;
                }
                return true;
            });

            // 4. Sequential Numbering
            const voucherRes = await getNextVoucherNumber(data.date);
            const invoiceNo = voucherRes.success ? voucherRes.data : `INV-QL-${Date.now().toString().slice(-6)}`;

            // 5. Totals Calculation
            const { line_items = [], payments = [], status = 'draft', total_discount = 0 } = data;
            const subtotalCalc = processedLineItems.reduce((sum, l) => sum + (safeNum(l.quantity) * safeNum(l.unit_price) - safeNum(l.discount_amount)), 0);
            const taxTotalCalc = processedLineItems.reduce((sum, l) => sum + safeNum(l.tax_amount), 0);
            const grandTotalCalc = Math.max(0, subtotalCalc + taxTotalCalc - safeNum(total_discount));
            const totalPaidCalc = payments.reduce((sum, p) => sum + safeNum(p.amount), 0);
            const outstandingCalc = (status === 'paid') ? 0 : Math.max(0, grandTotalCalc - totalPaidCalc);

            // [STABILITY-GUARD] Verify all product_ids exist before creating lines to prevent FK violations
            // Clinical items (Lab, Doctor etc) often pass identifiers that might not be in the product master.
            const candidateProductIds = processedLineItems.map(l => l.product_id).filter(isUUID);
            const verifiedProducts = await tx.hms_product.findMany({
                where: { 
                    id: { in: candidateProductIds },
                    company_id: companyId
                },
                select: { id: true }
            });
            const validProductIds = new Set(verifiedProducts.map(p => p.id));

            // 6. Persistence
            const invoiceId = crypto.randomUUID();
            const invoice = await tx.hms_invoice.create({
                data: {
                    id: invoiceId,
                    tenant_id: tenantId,
                    company_id: companyId,
                    invoice_number: invoiceNo,
                    invoice_no: invoiceNo,
                    invoice_date: new Date(data.date || new Date()),
                    subtotal: subtotalCalc,
                    total_tax: taxTotalCalc,
                    total_discount: safeNum(total_discount),
                    total: grandTotalCalc,
                    total_paid: totalPaidCalc,
                    status: status as any,
                    outstanding_amount: outstandingCalc,
                    patient_id: resolvedPatientId,
                    appointment_id: isUUID(data.appointment_id) ? data.appointment_id : null,
                    branch_id: isUUID(branchId) ? branchId : null,
                    created_by: isUUID(userId) ? userId : null,
                    hms_invoice_lines: {
                        create: processedLineItems.map((l: any, idx) => ({
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            line_idx: idx + 1,
                            description: l.description || "Service",
                            quantity: safeNum(l.quantity) || 1,
                            unit_price: safeNum(l.unit_price),
                            discount_amount: safeNum(l.discount_amount),
                            tax_amount: safeNum(l.tax_amount),
                            net_amount: (safeNum(l.quantity) * safeNum(l.unit_price)) - safeNum(l.discount_amount),
                            product_id: (isUUID(l.product_id) && validProductIds.has(l.product_id)) ? l.product_id : null,
                            tax_rate_id: isUUID(l.tax_rate_id) ? l.tax_rate_id : null,
                            uom: l.uom || 'Unit'
                        }))
                    },
                    hms_invoice_payments: payments.length > 0 ? {
                        create: payments.filter(p => safeNum(p.amount) > 0).map(p => ({
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            amount: safeNum(p.amount),
                            method: (['cash', 'card', 'upi', 'bank_transfer', 'insurance', 'adjustment'].includes(p.method) ? p.method : 'cash') as any,
                            payment_reference: p.reference || 'COUNTER_SALE', paid_at: new Date()
                        }))
                    } : undefined
                }
            });

            // --- WORLD CLASS STOCK SYNC (SALES) ---
            // [UOM-FIX] Fetch all products with conversions to ensure accurate deduction
            const pIds = processedLineItems.map(l => l.product_id).filter(isUUID);
            const productsWithUoms = await tx.hms_product.findMany({
                where: { id: { in: pIds } },
                include: { hms_product_uom_conversion: true }
            });
            const pLookup = new Map(productsWithUoms.map(p => [p.id, p]));

            // Deduct stock for all physical items in the invoice
            for (const item of processedLineItems) {
                if (!item.product_id) continue;
                const product = pLookup.get(item.product_id);
                if (!product) continue;

                // --- INTELLIGENT UOM CONVERSION v2 (Table-Driven) ---
                const normalizeUnit = (u: string) => {
                    let n = (u || 'Unit').toUpperCase().trim().replace(/S$/, ''); 
                    if (n === 'PC') return 'PCS'; // Map PC to PCS
                    return n;
                }
                const lineUomNorm = normalizeUnit(item.uom);
                const baseUomStrRaw = (product.uom || (product.metadata as any)?.base_uom || (product.metadata as any)?.uomData?.base_uom || 'PCS');
                const baseUomNorm = normalizeUnit(baseUomStrRaw);
                const prodMeta = (product.metadata as any) || {};
                
                let conversionFactor = 1;
                let usedMethod = "default_unit";

                if (lineUomNorm === baseUomNorm) {
                    conversionFactor = 1; 
                    usedMethod = "exact_match_normalized";
                } else {
                    // 1. Try UOM Conversion Table
                    const conversion = product.hms_product_uom_conversion.find(
                        (c: any) => normalizeUnit(c.from_uom) === lineUomNorm && normalizeUnit(c.to_uom) === baseUomNorm
                    );
                    
                    if (conversion) {
                        conversionFactor = Number(conversion.factor) || 1;
                        usedMethod = "conversion_table";
                    } else {
                        // 2. Try Legacy Metadata (packUom + packingQty)
                        const packUom = (prodMeta.packUom || prodMeta.pack_uom || (product.metadata as any)?.packUom || (product.metadata as any)?.pack_uom || '');
                        if (normalizeUnit(packUom) === lineUomNorm) {
                            conversionFactor = safeNum(prodMeta.packingQty || prodMeta.packing_qty || (product.metadata as any)?.packingQty || (product.metadata as any)?.packing_qty) || 1;
                            usedMethod = "legacy_meta_pack";
                        } else {
                            // 3. Try uomData inside metadata (Standardized Pharma metadata)
                            const uomData = prodMeta.uomData || prodMeta.uom_data || (product.metadata as any)?.uomData || (product.metadata as any)?.uom_data;
                            if (uomData && normalizeUnit(uomData.pack_uom || uomData.packUom) === lineUomNorm) {
                                conversionFactor = Number(uomData.conversion_factor || uomData.conversionFactor) || 1;
                                usedMethod = "standard_uom_data";
                            }
                        }
                    }
                }

                const qtyToDeduct = (safeNum(item.quantity) || 1) * conversionFactor;

                // 0. Resolve Location (Default to Main Warehouse for now)
                let location = await tx.hms_stock_location.findFirst({
                    where: { company_id: companyId, name: 'Main Warehouse' }
                });

                if (!location) {
                    location = await tx.hms_stock_location.findFirst({
                        where: { company_id: companyId }
                    });
                }

                if (location) {
                    // 1. Deduct Stock Level
                    const level = await tx.hms_stock_levels.findFirst({
                        where: {
                            company_id: companyId,
                            product_id: item.product_id,
                            location_id: location.id
                            // Not using batch for sales yet in this action, can be enhanced
                        }
                    });

                    if (level) {
                        await tx.hms_stock_levels.update({
                            where: { id: level.id },
                            data: { quantity: { decrement: qtyToDeduct } }
                        });
                    } else {
                        await tx.hms_stock_levels.create({
                            data: {
                                id: crypto.randomUUID(),
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: item.product_id,
                                location_id: location.id,
                                quantity: -qtyToDeduct
                            }
                        });
                    }

                    // --- [BATCH DEDUCTION: Priority Specific -> Fallback FIFO] ---
                    let remainingToDeduct = qtyToDeduct;
                    
                    // 1. If a specific batch was selected in the UI, deduct from it first
                    const explicitBatchId = item.batch_id || item.batchId;
                    if (isUUID(explicitBatchId)) {
                        const targetBatch = await tx.hms_product_batch.findFirst({
                            where: { id: explicitBatchId, company_id: companyId }
                        });
                        if (targetBatch) {
                            const deduction = Math.min(Number(targetBatch.qty_on_hand), remainingToDeduct);
                            await tx.hms_product_batch.update({
                                where: { id: targetBatch.id },
                                data: { qty_on_hand: { decrement: deduction } }
                            });
                            remainingToDeduct -= deduction;
                        }
                    }

                    // 2. If remaining (FIFO)
                    if (remainingToDeduct > 0) {
                        const batches = await tx.hms_product_batch.findMany({
                            where: { product_id: item.product_id, company_id: companyId, qty_on_hand: { gt: 0 } },
                            orderBy: { expiry_date: 'asc' } // FEFO approach
                        });

                        for (const batch of batches) {
                            if (remainingToDeduct <= 0) break;
                            const batchQty = Number(batch.qty_on_hand);
                            const deduction = Math.min(batchQty, remainingToDeduct);
                            
                            await tx.hms_product_batch.update({
                                where: { id: batch.id },
                                data: { qty_on_hand: { decrement: deduction } }
                            });
                            remainingToDeduct -= deduction;
                        }
                    }

                    // 3. Fallback: If still remaining (oversold), deduct from the newest batch even if it goes negative
                    if (remainingToDeduct > 0) {
                        const lastBatch = await tx.hms_product_batch.findFirst({
                            where: { product_id: item.product_id, company_id: companyId },
                            orderBy: { created_at: 'desc' }
                        });
                        if (lastBatch) {
                            await tx.hms_product_batch.update({
                                where: { id: lastBatch.id },
                                data: { qty_on_hand: { decrement: remainingToDeduct } }
                            });
                        }
                    }

                    // 2. Log Outward Movement in Ledger
                    await tx.hms_stock_ledger.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: item.product_id,
                            movement_type: 'out',
                            qty: -qtyToDeduct,
                            uom: item.uom || 'Unit',
                            unit_cost: 0,
                            total_cost: 0,
                            from_location_id: location.id,
                            batch_id: item.batch_id || item.batchId || null,
                            reference: invoiceNo,
                            related_type: 'hms_invoice',
                            related_id: invoiceId
                        }
                    });

                    // Stock deduction and ledger logging completed above.
                }
            }

            // Post-Hooks
            if (status === 'paid' && isUUID(data.appointment_id)) {
                await tx.hms_appointments.update({ where: { id: data.appointment_id }, data: { status: 'completed' } });
            }

            if (hasRegFee && resolvedPatientId && (status === 'posted' || status === 'paid')) {
                await trackRegistrationPayment(tx, resolvedPatientId, tenantId, companyId);
            }

            return invoice;
        }, { timeout: 15000 });

        // Handle the duplicate signal outside the transaction to clean up
        if ((result as any)._isDuplicate) {
            return updateInvoice((result as any).existingId, data);
        }

        const invoiceId = (result as any).id;
        const currentStatus = (result as any).status;

        // Trigger Accounting & Notification (Outside transaction for performance and robustness)
        if ((currentStatus === 'posted' || currentStatus === 'paid') && invoiceId) {
            try {
                const accountingRes = await AccountingService.postSalesInvoice(invoiceId, userId);
                if (!accountingRes.success) {
                    console.warn(`${LOG_PREFIX} Accounting Post Partial Failure:`, accountingRes.error);
                }
            } catch (err) {
                console.error(`${LOG_PREFIX} Accounting Post Exception:`, err);
            }
        }

        revalidatePath('/hms/billing');

        let whatsappFeedback = {};
        if ((currentStatus === 'paid' || currentStatus === 'posted') && invoiceId) {
            try {
                const config = await getWhatsAppConfig(companyId, tenantId);
                if (config?.autoSendBill) {
                    const wsRes = await NotificationService.sendInvoiceWhatsapp(invoiceId, tenantId);
                    whatsappFeedback = {
                        whatsapp_sent: wsRes.success,
                        whatsapp_error: wsRes.success ? null : wsRes.error
                    };
                }
            } catch (e) {
                console.error(`${LOG_PREFIX} WhatsApp Notification Failed:`, e);
            }
        }

        return { success: true, data: serialize(result), ...whatsappFeedback };

    } catch (err: any) {
        console.error(`${LOG_PREFIX} [CRITICAL-FAIL] createInvoice:`, err);
        return { error: `BILLING_CORE_FATAL: ${err.message}` };
    }
}

// Helper to check if a transaction is locked based on lock date or roles
async function checkTransactionLock(invoiceId: string, company_id: string, session: any) {
    const existing = await prisma.hms_invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true, invoice_date: true, issued_at: true, appointment_id: true }
    });

    if (!existing) throw new Error("Transaction node not found.");

    // 1. Lock Date Check (Fiscal Period)
    const settings = await prisma.company_accounting_settings.findUnique({
        where: { company_id }
    });

    if (settings?.lock_date) {
        const txDate = existing.invoice_date || existing.issued_at;
        if (new Date(txDate) <= new Date(settings.lock_date)) {
            return { locked: true, reason: `Fiscal period is closed. Transactions before ${new Date(settings.lock_date).toLocaleDateString()} are frozen.` };
        }
    }

    // 2. Role Check (Only Admin can edit posted/paid)
    const isAdmin = session?.user?.isAdmin;
    if (existing.status !== 'draft' && !isAdmin) {
        return { locked: true, reason: "Administrative privileges required to modify a finalized ledger entry." };
    }

    return { locked: false, existing };
}

export async function cancelInvoice(invoiceId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const lockCheck = await checkTransactionLock(invoiceId, companyId, session);
        if (lockCheck.locked) return { error: lockCheck.reason };

        await prisma.hms_invoice.update({
            where: { id: invoiceId },
            data: { status: 'cancelled' as any }
        });

        revalidatePath('/hms/billing');
        return { success: true, message: "Transaction voided successfully." };
    } catch (error: any) {
        return { error: error.message || "Failed to cancel transaction." };
    }
}

export async function updateInvoice(invoiceId: string, data: { patient_id: string, appointment_id?: string, date: string, line_items: any[], payments?: any[], status?: any, total_discount?: number, billing_metadata?: any }) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const companyId = (session?.user as any).companyId || tenantId;
    const userId = session?.user?.id;
    if (!companyId || !tenantId) return { error: "Unauthorized or Missing Tenant Context" };

    const lockCheck = await checkTransactionLock(invoiceId, companyId, session);
    if (lockCheck.locked) return { error: lockCheck.reason };

    const { patient_id, appointment_id, date, line_items, status = 'draft' as any, total_discount = 0, payments = [], billing_metadata = {} } = data;

    if (!line_items || line_items.length === 0) {
        return { error: "At least one line item is required" };
    }

    // [INTEGRITY-GUARD] Prevent posting if nursing items are pending confirmation
    if (status === 'posted' || status === 'paid') {
        const patientId = patient_id;
        if (patientId) {
            const recentAppts = await prisma.hms_appointments.findMany({
                where: {
                    patient_id: patientId,
                    starts_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                },
                select: { id: true }
            });
            const apptIds = recentAppts.map((a: any) => a.id);
            if (apptIds.length > 0) {
                const pendingMoves = await prisma.hms_stock_move.count({
                    where: {
                        source_reference: { in: apptIds },
                        source: 'Nursing Consumption (Pending)'
                    }
                });
                if (pendingMoves > 0) {
                    return { error: `Clinical Integrity Violation: ${pendingMoves} unconfirmed nursing items found for this patient's visits today. Advise nursing station to verify consumption before billing.` };
                }
            }
        }
    }

    try {
        // Calculate totals
        // Subtotal (Sum of [Qty * Price - Discount])
        const subtotal = line_items.reduce((sum: number, item: any) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            const discount = Number(item.discount_amount) || 0;
            const lineTotal = (qty * price) - discount;
            return sum + lineTotal;
        }, 0);

        // Tax Total (Sum of line item taxes)
        const totalTaxAmount = line_items.reduce((sum: number, item: any) => sum + (Number(item.tax_amount || 0)), 0);

        // Grand Total: Subtotal + Tax - Global Discount
        const total = Math.max(0, subtotal + totalTaxAmount - Number(total_discount || 0));

        // Calculate Payment Totals
        const paymentList = payments || [];
        const totalPaid = paymentList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

        // Determine Outstanding
        const outstandingAmount = (status === 'paid') ? 0 : Math.max(0, total - totalPaid);

        // [DEDUPLICATION-FIX] Fuzzy intra-invoice deduplication
        let processedLineItems = [...(line_items || [])];
        let regFound = false;
        processedLineItems = processedLineItems.filter((l: any) => {
            const desc = l.description?.toLowerCase() || "";
            const isReg = desc.includes('registration fee') || desc.includes('identity service') || (desc.includes('registration') && desc.includes('fee'));
            if (isReg) {
                if (regFound) return false;
                regFound = true;
                l.description = REG_FEE_DESCRIPTION; // Standardize
                return true;
            }
            return true;
        });

        // RE-CALCULATE TOTALS AFTER DEDUPLICATION
        const finalSubtotal = processedLineItems.reduce((sum: number, item: any) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            const discount = Number(item.discount_amount) || 0;
            const lineTotal = (qty * price) - discount;
            return sum + lineTotal;
        }, 0);
        const finalTaxTotal = processedLineItems.reduce((sum: number, item: any) => sum + (Number(item.tax_amount || 0)), 0);
        const finalGrandTotal = Math.max(0, finalSubtotal + finalTaxTotal - Number(total_discount || 0));
        const finalOutstanding = (status === 'paid') ? 0 : Math.max(0, finalGrandTotal - totalPaid);

        const result = await prisma.$transaction(async (tx) => {
            // [STABILITY-GUARD] Verify all product_ids exist before creating lines to prevent FK violations
            const candidateProductIds = processedLineItems.map(l => l.product_id).filter(isUUID);
            const verifiedProducts = await tx.hms_product.findMany({
                where: { 
                    id: { in: candidateProductIds },
                    company_id: companyId
                },
                select: { id: true }
            });
            const validProductIds = new Set(verifiedProducts.map(p => p.id));

            // 0. Resolve Old State (to prevent double-deduction)
            const oldInvoice = await tx.hms_invoice.findUnique({
                where: { id: invoiceId },
                select: { status: true }
            });

            // 1. Update Invoice Header
            const updatedInvoice = await tx.hms_invoice.update({
                where: { id: invoiceId },
                data: {
                    patient_id: (patient_id as string) || null,
                    appointment_id: (appointment_id as string) || null,
                    invoice_date: new Date(date),
                    status: status,
                    total: finalGrandTotal,
                    subtotal: finalSubtotal,
                    total_tax: finalTaxTotal,
                    total_discount: Number(total_discount),
                    total_paid: totalPaid,
                    outstanding_amount: finalOutstanding,
                    billing_metadata: billing_metadata,
                }
            });

            // --- WORLD CLASS STOCK SYNC (SALES TRANSITION) ---
            // If we are moving from Draft -> Posted/Paid, we MUST deduct stock.
            // If already posted/paid, we assume stock was already deducted (or managed via manual reconciliation if items changed)
            const wasDraft = !oldInvoice || oldInvoice.status === 'draft';
            const isNowFinalized = status === 'posted' || status === 'paid';

            if (wasDraft && isNowFinalized) {
                console.log(`[STOCKS-UPDATE] Transitional deduction for ${updatedInvoice.invoice_number}`);
                const upIds = processedLineItems.map(l => l.product_id).filter(isUUID);
                const upProds = await tx.hms_product.findMany({
                    where: { id: { in: upIds } },
                    include: { hms_product_uom_conversion: true }
                });
                const upLookup = new Map(upProds.map(p => [p.id, p]));

                for (const item of processedLineItems) {
                    if (!item.product_id) continue;
                    const product = upLookup.get(item.product_id);
                    if (!product) continue;

                    // --- INTELLIGENT UOM CONVERSION v2 (Table-Driven) ---
                    const meta = (item.metadata || {}) as any;
                    const normalizeUnit = (u: string) => {
                        let n = (u || 'Unit').toUpperCase().trim().replace(/S$/, ''); 
                        if (n === 'PC') return 'PCS'; // Map PC to PCS
                        return n;
                    }
                    const lineUomNorm = normalizeUnit(item.uom);
                    const baseUomStrRaw = (product.uom || (product.metadata as any)?.base_uom || (product.metadata as any)?.uomData?.base_uom || 'PCS');
                    const baseUomNorm = normalizeUnit(baseUomStrRaw);
                    const prodMeta = (product.metadata as any) || {};
                    
                    let conversionFactor = 1;
                    let usedMethod = "default_unit";

                    if (lineUomNorm === baseUomNorm) {
                        conversionFactor = 1; 
                        usedMethod = "exact_match_normalized";
                    } else {
                        const conversion = product.hms_product_uom_conversion.find(
                            (c: any) => normalizeUnit(c.from_uom) === lineUomNorm && normalizeUnit(c.to_uom) === baseUomNorm
                        );
                        if (conversion) {
                            conversionFactor = Number(conversion.factor) || 1;
                            usedMethod = "conversion_table";
                        } else {
                            const packUom = (prodMeta.packUom || prodMeta.pack_uom || (product.metadata as any)?.packUom || (product.metadata as any)?.pack_uom || '');
                            if (normalizeUnit(packUom) === lineUomNorm) {
                                conversionFactor = safeNum(prodMeta.packingQty || prodMeta.packing_qty || (product.metadata as any)?.packingQty || (product.metadata as any)?.packing_qty) || 1;
                                usedMethod = "legacy_meta_pack";
                            } else {
                                const uomData = prodMeta.uomData || prodMeta.uom_data || (product.metadata as any)?.uomData || (product.metadata as any)?.uom_data;
                                if (uomData && normalizeUnit(uomData.pack_uom || uomData.packUom) === lineUomNorm) {
                                    conversionFactor = Number(uomData.conversion_factor || uomData.conversionFactor) || 1;
                                    usedMethod = "standard_uom_data";
                                }
                            }
                        }
                    }

                    const qtyToDeduct = (safeNum(item.quantity) || 1) * conversionFactor;

                    // A. Resolve Location
                    let location = await tx.hms_stock_location.findFirst({
                        where: { company_id: companyId, name: 'Main Warehouse' }
                    });
                    if (!location) location = await tx.hms_stock_location.findFirst({ where: { company_id: companyId } });

                    if (location) {
                        // B. Deduct Stock Level
                        const level = await tx.hms_stock_levels.findFirst({
                            where: { company_id: companyId, product_id: item.product_id, location_id: location.id }
                        });

                        if (level) {
                            await tx.hms_stock_levels.update({
                                where: { id: level.id },
                                data: { quantity: { decrement: qtyToDeduct } }
                            });
                        } else {
                            await tx.hms_stock_levels.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    tenant_id: tenantId,
                                    company_id: companyId,
                                    product_id: item.product_id,
                                    location_id: location.id,
                                    quantity: -qtyToDeduct,
                                    reserved: 0
                                }
                            });
                        }

                        // C. Decouple Batch Qty (if batch linked)
                        const bId = item.batch_id || item.batchId || (item.metadata as any)?.batch_id;
                        if (isUUID(bId)) {
                            await tx.hms_product_batch.update({
                                where: { id: bId },
                                data: { qty_on_hand: { decrement: qtyToDeduct } }
                            });
                        }

                        // D. Log Ledger Entry
                        await tx.hms_stock_ledger.create({
                            data: {
                                id: crypto.randomUUID(),
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: item.product_id,
                                movement_type: 'out',
                                qty: -qtyToDeduct,
                                uom: item.uom || 'Unit',
                                unit_cost: 0,
                                total_cost: 0,
                                reference: updatedInvoice.invoice_number,
                                created_by: userId,
                                metadata: { 
                                    source: 'Sales/Update',
                                    sold_uom: item.uom,
                                    base_uom: baseUomStrRaw,
                                    factor: conversionFactor,
                                    original_qty: item.quantity,
                                    deduction_qty: qtyToDeduct,
                                    method: usedMethod,
                                    invoice_id: invoiceId 
                                }
                            }
                        });
                    }
                }
            }

            // 2. Delete existing lines (Simple approach for MVP)
            await tx.hms_invoice_lines.deleteMany({
                where: { invoice_id: invoiceId }
            });

            // 3. Resolve Taxes & Create new lines
            const resolvedLineItems = await Promise.all(processedLineItems.map(async (l: any) => {
                if (l.tax_rate_id && l.tax_rate_id.toString().startsWith('AUTO_')) {
                    const rate = parseFloat(l.tax_rate_id.replace('AUTO_', ''));
                    const realId = await resolveAutoTax(rate, session.user.tenantId, (companyId as string));
                    if (realId) return { ...l, tax_rate_id: realId };
                }
                return l;
            }));

            await tx.hms_invoice_lines.createMany({
                data: resolvedLineItems.map((item: any, index: number) => ({
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    invoice_id: invoiceId,
                    line_idx: index + 1,
                    product_id: (isUUID(item.product_id) && validProductIds.has(item.product_id)) ? item.product_id : null,
                    description: item.description || "Service Item",
                    quantity: safeNum(item.quantity) || 1,
                    unit_price: safeNum(item.unit_price),
                    net_amount: (safeNum(item.quantity) * safeNum(item.unit_price)) - safeNum(item.discount_amount),
                    // Tax details
                    tax_rate_id: isUUID(item.tax_rate_id) ? item.tax_rate_id : null,
                    tax_amount: safeNum(item.tax_amount),
                    discount_amount: safeNum(item.discount_amount),
                    uom: item.uom || 'Unit',
                    metadata: {
                        batch_id: item.batch_id,
                        batch_no: item.batch_no
                    }
                }))
            });

            // 4. Update Payments (Sync approach)
            await tx.hms_invoice_payments.deleteMany({
                where: { invoice_id: invoiceId }
            });

            if (paymentList.length > 0) {
                await tx.hms_invoice_payments.createMany({
                    data: paymentList.map((p: any) => ({
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        invoice_id: invoiceId,
                        amount: safeNum(p.amount),
                        method: (['cash', 'card', 'upi', 'bank_transfer', 'insurance', 'adjustment'].includes(p.method) ? p.method : 'cash') as any,
                        payment_reference: p.reference || null,
                        paid_at: new Date()
                    }))
                });

                // WORLD CLASS: Auto-Allocation of Excess Funds (Reconciliation)
                if (totalPaid > total && patient_id) {
                    let excess = totalPaid - total;
                    const oldInvoices = await tx.hms_invoice.findMany({
                        where: {
                            tenant_id: session.user.tenantId,
                            company_id: companyId,
                            patient_id: patient_id as string,
                            status: 'posted' as any,
                            id: { not: invoiceId }
                        },
                        orderBy: { issued_at: 'asc' }
                    });

                    for (const oldInv of oldInvoices) {
                        if (excess <= 0) break;
                        const due = Number(oldInv.outstanding_amount || 0);
                        const paymentToApply = Math.min(due, excess);

                        if (paymentToApply > 0) {
                            await tx.hms_invoice.update({
                                where: { id: oldInv.id },
                                data: {
                                    total_paid: Number(oldInv.total_paid || 0) + paymentToApply,
                                    outstanding_amount: due - paymentToApply,
                                    status: (due - paymentToApply <= 0.01) ? 'paid' as any : 'posted' as any
                                }
                            });
                            excess -= paymentToApply;
                        }
                    }
                }
            }

            // If status is paid and appointment is linked, mark appointment as completed
            if (status === 'paid' && appointment_id) {
                await tx.hms_appointments.update({
                    where: { id: appointment_id },
                    data: { status: 'completed' }
                });
            }

            // [WORLD CLASS] Registration Fee Tracking
            const hasRegistrationFee = line_items.some((l: any) => {
                const desc = (l.description || l.name || "").toLowerCase();
                return desc.includes('registration fee') || desc.includes('registration & identity service');
            });
            if (hasRegistrationFee && patient_id && (status === 'posted' || status === 'paid')) {
                await trackRegistrationPayment(tx, patient_id as string, session.user.tenantId, companyId);
            }

            // FORCE UPDATE TOTAL: Ensure DB triggers didn't override the total to 0
            // This happens if a trigger calculates total from lines before lines are fully visible/committed
            await tx.hms_invoice.update({
                where: { id: invoiceId },
                data: {
                    total: total,
                    subtotal: subtotal,
                    total_tax: totalTaxAmount,
                    outstanding_amount: (status === 'paid') ? 0 : Math.max(0, total - totalPaid)
                }
            });

            // Note: Returning updatedInvoice here might not reflect the force update if fetched from 'update' result earlier.
            // But since we just updated it again, if we wanted the fresh object we'd need to fetch it.
            // For now, assuming the caller just needs the ID or basic success.
            // To be safe, let's return a constructed object or just the earlier reference (the amount might be wrong in the returned object but correct in DB).
            // Actually, let's just return the result of the LAST update.
            return { ...updatedInvoice, total, subtotal, total_tax: totalTaxAmount };
        });

        if ((result.status === 'posted' || result.status === 'paid') && result.id) {
            try {
                const accountingRes = await AccountingService.postSalesInvoice(result.id, session.user.id);
                if (!accountingRes.success) {
                    console.warn("Accounting Post Partial Failure:", accountingRes.error);
                }
            } catch (err) {
                console.error("Accounting Post Exception:", err);
            }

            // WhatsApp Notification (Only if paid/posted and auto-send enabled)
            if (result.status === 'paid' || result.status === 'posted') {
                try {
                    const config = await getWhatsAppConfig(companyId, session.user.tenantId!);
                    if (config?.autoSendBill) {
                        const wsRes = await NotificationService.sendInvoiceWhatsapp(result.id, session.user.tenantId!);
                        if (!wsRes.success) console.warn("Auto-WhatsApp Send Failed:", wsRes.error);
                    }
                } catch (err) {
                    console.error("WhatsApp Notification Orchestration Failed:", err);
                }
            }
        }

        revalidatePath('/hms/billing');
        revalidatePath(`/hms/billing/${invoiceId}`);
        return { success: true, data: serialize(result) };

    } catch (error: any) {
        console.error("Failed to update invoice:", error);
        return { error: `Failed to update invoice: ${error.message}` };
    }
}

export async function updateInvoiceStatus(invoiceId: string, status: any) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const invoice = await prisma.hms_invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) return { error: "Invoice not found" };

        // [INTEGRITY-GUARD] Prevent posting if nursing items are pending confirmation
        if (status === 'posted' || status === 'paid') {
            if (invoice.patient_id) {
                const recentAppts = await prisma.hms_appointments.findMany({
                    where: {
                        patient_id: invoice.patient_id,
                        starts_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    },
                    select: { id: true }
                });
                const apptIds = recentAppts.map((a: any) => a.id);
                if (apptIds.length > 0) {
                    const pendingMoves = await prisma.hms_stock_move.count({
                        where: {
                            source_reference: { in: apptIds },
                            source: 'Nursing Consumption (Pending)'
                        }
                    });
                    if (pendingMoves > 0) {
                        return { error: `Clinical Integrity Violation: ${pendingMoves} unconfirmed nursing items found for this patient's visits today. Advise nursing station to verify consumption before billing.` };
                    }
                }
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.hms_invoice.update({
                where: { id: invoiceId },
                data: {
                    status: status,
                    outstanding_amount: status === 'paid' ? 0 : (status === 'posted' ? invoice.total : invoice.outstanding_amount),
                    updated_at: new Date()
                },
                include: { hms_invoice_lines: true }
            });

            // --- WORLD CLASS STOCK SYNC (STATUS TRANSITION) ---
            const wasDraft = invoice.status === 'draft';
            const isNowFinalized = status === 'posted' || status === 'paid';

            if (wasDraft && isNowFinalized) {
                console.log(`[STOCKS-STATUS-UPDATE] Transitional deduction for ${updated.invoice_number}`);
                const companyIdRaw = (session?.user as any).companyId || session?.user?.tenantId;
                const tenantIdRaw = session?.user?.tenantId;

                for (const item of updated.hms_invoice_lines) {
                    if (!item.product_id) continue;

                    const qtyToDeduct = safeNum(item.quantity) || 1;

                    // A. Resolve Location
                    let location = await tx.hms_stock_location.findFirst({
                        where: { company_id: companyIdRaw, name: 'Main Warehouse' }
                    });
                    if (!location) location = await tx.hms_stock_location.findFirst({ where: { company_id: companyIdRaw } });

                    if (location) {
                        // B. Deduct Stock Level
                        const level = await tx.hms_stock_levels.findFirst({
                            where: { company_id: companyIdRaw, product_id: item.product_id, location_id: location.id }
                        });

                        if (level) {
                            await tx.hms_stock_levels.update({
                                where: { id: level.id },
                                data: { quantity: { decrement: qtyToDeduct } }
                            });
                        } else {
                            await tx.hms_stock_levels.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    tenant_id: tenantIdRaw!,
                                    company_id: companyIdRaw,
                                    product_id: item.product_id,
                                    location_id: location.id,
                                    quantity: -qtyToDeduct,
                                    reserved: 0
                                }
                            });
                        }

                        // C. Decouple Batch Qty (if batch linked in metadata)
                        const bId = (item.metadata as any)?.batch_id || (item.metadata as any)?.batchId;
                        if (isUUID(bId)) {
                            await tx.hms_product_batch.update({
                                where: { id: bId },
                                data: { qty_on_hand: { decrement: qtyToDeduct } }
                            });
                        }

                        // D. Log Ledger Entry
                        await tx.hms_stock_ledger.create({
                            data: {
                                id: crypto.randomUUID(),
                                tenant_id: tenantIdRaw!,
                                company_id: companyIdRaw,
                                product_id: item.product_id,
                                movement_type: 'out',
                                qty: -qtyToDeduct,
                                uom: item.uom || 'Unit',
                                unit_cost: 0,
                                total_cost: 0,
                                from_location_id: location.id,
                                reference: updated.invoice_number!,
                                created_by: session.user.id,
                                metadata: { source: 'Sales/StatusUpdate', invoice_id: invoiceId }
                            }
                        });
                    }
                }
            }

            // If paid, close appointment
            if (status === 'paid' && updated.appointment_id) {
                await tx.hms_appointments.update({
                    where: { id: updated.appointment_id },
                    data: { status: 'completed' }
                });
            }

            return updated;
        });

        // Trigger Accounting
        if (status === 'posted' || status === 'paid') {
            const accountingRes = await AccountingService.postSalesInvoice(invoiceId, session.user.id);
            if (!accountingRes.success) {
                console.warn("Accounting Post Failed:", accountingRes.error);
                return { success: true, warning: accountingRes.error };
            }
        }

        revalidatePath(`/hms/billing/${invoiceId}`);
        revalidatePath('/hms/billing');
        return { success: true };

    } catch (error: any) {
        console.error("Failed to update status:", error);
        return { error: `Failed to update status: ${error.message}` };
    }
}

export async function recordPayment(invoiceId: string, payment: { amount: number, method: string, reference?: string }, newStatus: any = 'paid') {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const invoice = await prisma.hms_invoice.findUnique({
            where: { id: invoiceId },
            include: {
                hms_invoice_payments: true,
                hms_invoice_lines: true
            }
        });
        if (!invoice) return { error: "Invoice not found" };

        // [INTEGRITY-GUARD] Prevent posting if nursing items are pending confirmation
        // recordPayment often results in status change to 'paid'
        if (invoice.patient_id) {
            const recentAppts = await prisma.hms_appointments.findMany({
                where: {
                    patient_id: invoice.patient_id,
                    starts_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                },
                select: { id: true }
            });
            const apptIds = recentAppts.map((a: any) => a.id);
            if (apptIds.length > 0) {
                const pendingMoves = await prisma.hms_stock_move.count({
                    where: {
                        source_reference: { in: apptIds },
                        source: 'Nursing Consumption (Pending)'
                    }
                });
                if (pendingMoves > 0) {
                    return { error: `Clinical Integrity Violation: ${pendingMoves} unconfirmed nursing items found for this patient's visits today. Advise nursing station to verify consumption before billing.` };
                }
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Payment Record
            // Handle empty strings as null to prevent unique constraint violation on ""
            const reference = payment.reference ? payment.reference.trim() : null;
            const finalReference = reference === "" ? null : reference;

            // Check for duplicate reference if provided
            if (finalReference) {
                const existing = await tx.hms_invoice_payments.findFirst({
                    where: {
                        tenant_id: session.user.tenantId,
                        company_id: companyId,
                        payment_reference: finalReference
                    }
                });
                if (existing) {
                    throw new Error(`Payment reference '${finalReference}' already exists.`);
                }
            }

            await tx.hms_invoice_payments.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId,
                    company_id: companyId,
                    invoice_id: invoiceId,
                    amount: payment.amount,
                    method: payment.method as any,
                    payment_reference: finalReference,
                    paid_at: new Date()
                }
            });

            // 2. Recalculate Totals
            const totalPaid = Number(invoice.total_paid || 0) + Number(payment.amount);
            const outstanding = Math.max(0, Number(invoice.total) - totalPaid);
            const finalStatus = outstanding === 0 ? 'paid' : newStatus; // Auto-paid if fully settled

            // 3. Update Invoice
            const updated = await tx.hms_invoice.update({
                where: { id: invoiceId },
                data: {
                    total_paid: totalPaid,
                    outstanding_amount: outstanding,
                    status: finalStatus as any,
                    updated_at: new Date()
                }
            });

            // --- WORLD CLASS STOCK SYNC (PAYMENT TRANSITION) ---
            const wasDraft = invoice.status === 'draft';
            const isNowFinalized = finalStatus === 'posted' || finalStatus === 'paid';

            if (wasDraft && isNowFinalized) {
                console.log(`[STOCKS-PAYMENT-UPDATE] Transitional deduction for ${invoice.invoice_number}`);
                const companyIdRaw = (session?.user as any).companyId || session?.user?.tenantId;
                const tenantIdRaw = session?.user?.tenantId;

                for (const item of (invoice as any).hms_invoice_lines || []) {
                    if (!item.product_id) continue;

                    const qtyToDeduct = safeNum(item.quantity) || 1;

                    // A. Resolve Location
                    let location = await tx.hms_stock_location.findFirst({
                        where: { company_id: companyIdRaw, name: 'Main Warehouse' }
                    });
                    if (!location) location = await tx.hms_stock_location.findFirst({ where: { company_id: companyIdRaw } });

                    if (location) {
                        // B. Deduct Stock Level
                        const level = await tx.hms_stock_levels.findFirst({
                            where: { company_id: companyIdRaw, product_id: item.product_id, location_id: location.id }
                        });

                        if (level) {
                            await tx.hms_stock_levels.update({
                                where: { id: level.id },
                                data: { quantity: { decrement: qtyToDeduct } }
                            });
                        } else {
                            await tx.hms_stock_levels.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    tenant_id: tenantIdRaw!,
                                    company_id: companyIdRaw,
                                    product_id: item.product_id,
                                    location_id: location.id,
                                    quantity: -qtyToDeduct,
                                    reserved: 0
                                }
                            });
                        }

                        // C. Decouple Batch Qty
                        const bId = (item.metadata as any)?.batch_id || (item.metadata as any)?.batchId;
                        if (isUUID(bId)) {
                            await tx.hms_product_batch.update({
                                where: { id: bId },
                                data: { qty_on_hand: { decrement: qtyToDeduct } }
                            });
                        }

                        // D. Log Ledger Entry
                        await tx.hms_stock_ledger.create({
                            data: {
                                id: crypto.randomUUID(),
                                tenant_id: tenantIdRaw!,
                                company_id: companyIdRaw,
                                product_id: item.product_id,
                                movement_type: 'out',
                                qty: -qtyToDeduct,
                                uom: item.uom || 'Unit',
                                unit_cost: 0,
                                total_cost: 0,
                                from_location_id: location.id,
                                reference: invoice.invoice_number!,
                                created_by: session.user.id,
                                metadata: { source: 'Sales/PaymentUpdate', invoice_id: invoiceId }
                            }
                        });
                    }
                }
            }

            // If paid, close appointment
            if (finalStatus === 'paid' && updated.appointment_id) {
                await tx.hms_appointments.update({
                    where: { id: updated.appointment_id },
                    data: { status: 'completed' }
                });
            }

            // [WORLD CLASS] Registration Fee Audit Trigger
            // If this invoice contains a Registration Fee, update the patient's expiry date
            const regLine = (invoice as any).hms_invoice_lines.find((l: any) =>
                l.description?.toLowerCase().includes('registration fee') ||
                l.description?.toLowerCase().includes('identity service')
            );

            if (regLine && finalStatus === 'paid' && invoice.patient_id) {
                // [RCM-FIX] Fetch validity from settings instead of hardcoded 1 year
                const hmsConfigRecord = await tx.hms_settings.findFirst({
                    where: {
                        company_id: companyId,
                        tenant_id: session.user.tenantId,
                        key: 'registration_config'
                    }
                });
                const configData = (hmsConfigRecord?.value as any) || {};
                const validityDays = parseInt(configData.validity || '7');

                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + validityDays);

                const patient = await tx.hms_patient.findUnique({ where: { id: invoice.patient_id } });
                const currentMeta = (patient?.metadata as any) || {};

                await tx.hms_patient.update({
                    where: { id: invoice.patient_id },
                    data: {
                        metadata: {
                            ...currentMeta,
                            registration_expiry: expiryDate.toISOString(),
                            registration_fees_paid: true,
                            registration_fee_date: new Date().toISOString(),
                            status: 'active'
                        }
                    }
                });
            }

            return updated;
        });

        // Trigger Accounting & Notification
        if (result.status === 'paid' || result.status === 'posted') {
            await AccountingService.postSalesInvoice(invoiceId, session.user.id);

            // Check for Auto-send setting before firing
            try {
                const wsConfig = await getWhatsAppConfig(session.user.companyId!, session.user.tenantId!);
                if (wsConfig?.autoSendBill) {
                    const wsRes = await NotificationService.sendInvoiceWhatsapp(invoiceId, session.user.tenantId!);
                    if (!wsRes.success) console.warn("[Billing-AutoSend] WhatsApp Send Failed:", wsRes.error);
                }
            } catch (err) {
                console.error("[Billing-AutoSend] WhatsApp Notification Orchestration Failed:", err);
            }
        }

        revalidatePath(`/hms/billing/${invoiceId}`);
        revalidatePath('/hms/billing');
        revalidatePath('/hms/lab/dashboard'); // Refresh lab dashboard to show updated invoice status
        revalidatePath('/hms/reception/dashboard'); // Refresh reception dashboard
        return { success: true, data: serialize(result) };

    } catch (error: any) {
        console.error("Failed to record payment:", error);
        // Return a cleaner error message
        if (error.message.includes("Unique constraint failed") || error.message.includes("already exists")) {
            return { error: `Payment Reference '${payment.reference}' is duplicate. Please use a unique reference.` };
        }
        return { error: error.message || "Failed to record payment" };
    }
}

export async function settlePatientDues(patientId: string, amount: number, method: string, reference?: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        if (amount <= 0) return { error: "Amount must be greater than 0" };

        let remainingAmount = amount;
        const settledInvoices = [];

        // 1. Fetch Outstanding Invoices (Oldest First)
        const invoices = await prisma.hms_invoice.findMany({
            where: {
                company_id: companyId,
                patient_id: patientId,
                status: { in: ['posted', 'draft'] as any }, // Allow paying Draft invoices (auto-posts them)
                outstanding_amount: { gt: 0 }
            },
            orderBy: { created_at: 'asc' }
        });

        const paymentResults = await prisma.$transaction(async (tx) => {
            const results = [];

            for (const inv of invoices) {
                if (remainingAmount <= 0) break;

                const payAmount = Math.min(Number(inv.outstanding_amount), remainingAmount);
                remainingAmount -= payAmount;

                // Create Payment Record
                const payment = await tx.hms_invoice_payments.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId,
                        company_id: companyId,
                        invoice_id: inv.id,
                        amount: payAmount,
                        method: (['cash', 'card', 'upi', 'bank_transfer', 'insurance', 'adjustment'].includes(method) ? method : 'cash') as any,
                        payment_reference: reference || `Settlement-${new Date().getTime()}`,
                        paid_at: new Date()
                    }
                });

                // Update Invoice
                const totalPaid = Number(inv.total_paid || 0) + payAmount;
                const outstanding = Number(inv.total) - totalPaid;
                const newStatus = outstanding <= 0.01 ? 'paid' : 'posted'; // Tolerance for float

                await tx.hms_invoice.update({
                    where: { id: inv.id },
                    data: {
                        total_paid: totalPaid,
                        outstanding_amount: outstanding,
                        status: newStatus
                    }
                });

                results.push({ invoiceId: inv.id, payAmount, status: newStatus });
            }

            // TODO: If remainingAmount > 0, store as Patient Advance (Ledger)
            // For now, we only settle invoices. Ideally we would create a Credit Note or Advance Payment.

            return results;
        });

        // 2. Trigger Accounting and Collect Errors
        const accountingErrors: string[] = [];
        const autoSendConfig = await getWhatsAppConfig(companyId, session.user.tenantId!).catch(() => null);

        for (const res of paymentResults) {
            try {
                const accountingRes = await AccountingService.postSalesInvoice(res.invoiceId, session.user.id);
                if (!accountingRes.success) accountingErrors.push(`Invoice ${res.invoiceId}: ${accountingRes.error}`);

                // Trigger Auto-send if enabled and invoice is now finalized (paid or posted)
                if ((res.status === 'paid' || res.status === 'posted') && autoSendConfig?.autoSendBill) {
                    try {
                        await NotificationService.sendInvoiceWhatsapp(res.invoiceId, session.user.tenantId!);
                    } catch (err) {
                        console.error(`Failed to send WhatsApp for settled invoice ${res.invoiceId}:`, err);
                    }
                }
            } catch (err: any) {
                console.error(`Failed to post accounting/notification for settled invoice ${res.invoiceId}:`, err);
                accountingErrors.push(`Invoice ${res.invoiceId}: ${err.message}`);
            }
        }

        // 3. SELF-HEALING: If no invoices were settled (because they are already marked 'paid'?)
        // but the user is trying to pay (implying 'getPatientBalance' showed a due),
        // we might have a sync issue. Let's force-sync recent invoices.
        let syncedCount = 0;
        if (paymentResults.length === 0 && amount > 0) {
            const recentPaidInvoices = await prisma.hms_invoice.findMany({
                where: {
                    patient_id: patientId,
                    // We check paid or posted invoices that might have unposted payments
                    status: { in: ['paid', 'posted'] as any },
                },
                orderBy: { updated_at: 'desc' },
                take: 10
            });

            for (const inv of recentPaidInvoices) {
                await AccountingService.postSalesInvoice(inv.id, session.user.id);
                syncedCount++;
            }
        }

        revalidatePath('/hms/billing');

        let message = `Successfully settled ${paymentResults.length} invoice(s).`;
        if (syncedCount > 0) message += ` (Synced ${syncedCount} historical invoices)`;
        if (accountingErrors.length > 0) message += ` Accounting Warning: ${accountingErrors.join(', ')}`;

        return {
            success: accountingErrors.length === 0 || paymentResults.length > 0 || syncedCount > 0,
            settled: paymentResults.length,
            remainingOffset: remainingAmount,
            message: message,
            error: accountingErrors.length > 0 ? accountingErrors.join(', ') : undefined
        };

    } catch (error: any) {
        console.error("Settlement Error:", error);
        return { error: error.message || "Failed to settle dues" };
    }
}

export async function voidPayment(paymentId: string, reason: string = "Payment Failed/Reversed") {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const payment = await prisma.hms_invoice_payments.findUnique({
            where: { id: paymentId },
            include: { hms_invoice: true }
        });

        if (!payment) return { error: "Payment record not found" };

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Invoice Totals
            const invoice = payment.hms_invoice;
            const newTotalPaid = Math.max(0, Number(invoice.total_paid || 0) - Number(payment.amount));
            const newOutstanding = Math.min(Number(invoice.total), Number(invoice.outstanding_amount || 0) + Number(payment.amount));

            // Revert status to posted if it was paid
            const newStatus = newOutstanding > 0 ? 'posted' : 'paid';

            await tx.hms_invoice.update({
                where: { id: payment.invoice_id },
                data: {
                    total_paid: newTotalPaid,
                    outstanding_amount: newOutstanding,
                    status: newStatus as any,
                    updated_at: new Date()
                }
            });

            // 2. Log in History
            await tx.hms_invoice_history.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: companyId,
                    invoice_id: payment.invoice_id,
                    changed_by: session.user.id,
                    change_type: 'payment_voided',
                    delta: {
                        payment_id: paymentId,
                        amount: payment.amount,
                        method: payment.method,
                        reason: reason
                    }
                }
            });

            // 3. Reverse Registration Status if applicable
            const regLine = await tx.hms_invoice_lines.findFirst({
                where: {
                    invoice_id: payment.invoice_id,
                    OR: [
                        { description: { contains: 'Registration Fee', mode: 'insensitive' } },
                        { description: { contains: 'Identity Service', mode: 'insensitive' } }
                    ]
                }
            });

            if (regLine && invoice.patient_id) {
                const patient = await tx.hms_patient.findUnique({ where: { id: invoice.patient_id } });
                const currentMeta = (patient?.metadata as any) || {};

                if (currentMeta.registration_fees_paid) {
                    await tx.hms_patient.update({
                        where: { id: invoice.patient_id },
                        data: {
                            metadata: {
                                ...currentMeta,
                                registration_fees_paid: false,
                                status: 'inactive'
                            }
                        }
                    });
                }
            }

            // 4. Delete accounting journal if exists
            const paymentRef = `PMT-${paymentId}`;
            await tx.journal_entries.deleteMany({
                where: {
                    company_id: companyId,
                    ref: paymentRef
                }
            });

            // 5. Delete the specific payment record
            await tx.hms_invoice_payments.delete({
                where: { id: paymentId }
            });

            return { success: true };
        });

        revalidatePath(`/hms/billing/${payment.invoice_id}`);
        revalidatePath('/hms/billing');
        revalidatePath('/hms/reception/dashboard');

        return result;

    } catch (error: any) {
        console.error("Failed to void payment:", error);
        return { error: error.message || "Failed to void payment" };
    }
}


export async function shareInvoiceWhatsapp(invoiceId: string, pdfBase64?: string) {
    const session = await auth();
    if (!session?.user?.tenantId) return { error: "Unauthorized" };

    try {
        const result = await NotificationService.sendInvoiceWhatsapp(invoiceId, session.user.tenantId, pdfBase64);
        return result;
    } catch (error: any) {
        console.error("Manual WhatsApp Share Failed:", error);
        return { error: error.message };
    }
}

export async function getPatientBalance(patientId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const getLedgerBalance = async () => {
            const result = await prisma.journal_entry_lines.aggregate({
                where: {
                    partner_id: patientId,
                    company_id: companyId,
                    journal_entries: { posted: true }
                },
                _sum: { debit: true, credit: true }
            });
            const totalDebit = Number(result._sum.debit || 0);
            const totalCredit = Number(result._sum.credit || 0);
            return totalDebit - totalCredit;
        };

        let activeBalance = await getLedgerBalance();

        // Add DRAFT invoices (Running Bills) which are not yet in Ledger
        const draftInvoices = await prisma.hms_invoice.aggregate({
            where: {
                patient_id: patientId,
                company_id: companyId,
                status: 'draft' as any
            },
            _sum: { outstanding_amount: true }
        });
        const draftAmount = Number(draftInvoices._sum.outstanding_amount || 0);

        // Effective Balance = Ledger (Posted/Paid) + Drafts (Unposted Consumption)
        const finalBalance = activeBalance + draftAmount;

        return {
            success: true,
            balance: Math.abs(finalBalance),
            type: finalBalance > 0.1 ? 'due' : (finalBalance < -0.1 ? 'advance' : 'due'),
            rawBalance: finalBalance,
            breakdown: {
                ledger: activeBalance,
                draft: draftAmount
            }
        };
    } catch (error: any) {
        console.error("Failed to fetch patient balance:", error);
        return { error: "Failed to fetch balance" };
    }
}

export async function createQuickPatient(name: string, phone: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        // Split name
        const parts = name.trim().split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || '.';

        const count = await prisma.hms_patient.count({ where: { tenant_id: session.user.tenantId } });
        const patientNumber = `P${new Date().getFullYear()}${String(count + 1).padStart(5, '0')}`;

        const newPatient = await prisma.hms_patient.create({
            data: {
                tenant_id: session.user.tenantId!,
                company_id: companyId,
                first_name: firstName,
                last_name: lastName,
                patient_number: patientNumber,

                gender: 'unknown',
                dob: new Date(), // Default to today/unknown
                contact: { phone: phone, address: 'Walk-in' },
                metadata: {
                    source: 'quick_billing',
                    is_walk_in: true
                }
            }
        });

        return { success: true, data: serialize(newPatient) };
    } catch (error: any) {
        console.error("Failed to create quick patient:", error);
        if (error.code === 'P2002') {
            return { error: "Patient with this details might already exist." };
        }
        return { error: `Failed to create patient: ${error.message}` };
    }
}

export async function recordPatientConsumption(patientId: string, items: any[], notes?: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    if (!items || items.length === 0) return { error: "No items to record" };

    try {
        // 1. Find an Active (Draft) Invoice for this Patient (The "Running Bill")
        const activeInvoice = await prisma.hms_invoice.findFirst({
            where: {
                company_id: companyId,
                patient_id: patientId,
                status: 'draft' as any // Crucial: We add to the DRAFT invoice
            },
            orderBy: { created_at: 'desc' },
            include: { hms_invoice_lines: true }
        });

        if (activeInvoice) {
            // APPEND to Existing Draft
            await prisma.$transaction(async (tx) => {
                // Determine next line index
                const maxIdx = activeInvoice.hms_invoice_lines.reduce((max, l) => Math.max(max, l.line_idx), 0);
                let currentIdx = maxIdx + 1;

                // Create Lines
                await tx.hms_invoice_lines.createMany({
                    data: items.map((item) => ({
                        tenant_id: session.user.tenantId,
                        company_id: companyId,
                        invoice_id: activeInvoice.id,
                        line_idx: currentIdx++,
                        product_id: item.productId || null,
                        description: item.name || item.description,
                        quantity: item.quantity || 1,
                        unit_price: item.price || 0,
                        net_amount: ((item.quantity || 1) * (item.price || 0)),
                        tax_amount: 0,
                        discount_amount: 0,
                        metadata: {
                            added_at: new Date().toISOString(),
                            notes: notes,
                            type: 'consumption'
                        }
                    }))
                });

                // Recalculate Totals
                // Fetch ALL lines again to ensure accuracy
                const allLines = await tx.hms_invoice_lines.findMany({ where: { invoice_id: activeInvoice.id } });

                const subtotal = allLines.reduce((sum, l) => sum + Number(l.net_amount), 0);
                const totalTax = allLines.reduce((sum, l) => sum + Number(l.tax_amount || 0), 0);
                const total = subtotal + totalTax;

                await tx.hms_invoice.update({
                    where: { id: activeInvoice.id },
                    data: {
                        subtotal,
                        total_tax: totalTax,
                        total,
                        outstanding_amount: total - Number(activeInvoice.total_paid || 0),
                        updated_at: new Date()
                    }
                });
            });

            revalidatePath('/hms/billing');
            return { success: true, message: `Added to running bill: ${activeInvoice.invoice_number}`, invoiceId: activeInvoice.id };

        } else {
            // CREATE New "Running Bill" (Draft Invoice)
            const payload = {
                patient_id: patientId,
                date: new Date().toISOString(),
                status: 'draft' as any,
                line_items: items.map(item => ({
                    product_id: item.productId,
                    description: item.name || item.description,
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0,
                    tax_amount: 0,
                    discount_amount: 0
                })),
                billing_metadata: {
                    notes: notes,
                    origin: 'consumption_log',
                    is_running_bill: true
                }
            };

            const res: any = await createInvoice(payload);
            if (res.error) throw new Error(res.error);

            const newId = (res as any).data?.id;
            return { success: true, message: "Created new detailed bill", invoiceId: newId };
        }

    } catch (error: any) {
        console.error("Failed to record consumption:", error);
        return { error: error.message };
    }
}

/**
 * World Class Ledger Analytics: 
 * Fetches the real-time financial standing of a patient across all sub-ledgers.
 */
export async function getPatientOutstandingBalance(patientId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId || !patientId) return { error: "Unauthorized or missing ID" };

    try {
        const invoices = await prisma.hms_invoice.findMany({
            where: {
                tenant_id: session.user.tenantId,
                company_id: companyId,
                patient_id: patientId,
                status: 'posted' as any // Only confirmed debts (unpaid or partially paid)
            },
            select: {
                outstanding_amount: true
            }
        });

        const totalDebt = invoices.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0);

        return { success: true, balance: totalDebt };
    } catch (error: any) {
        console.error("Ledger Fetch Failed:", error);
        return { error: "Could not compute patient balance" };
    }
}

/**
 * World Class Financial Transparency:
 * Fetches the full audit trail of all financial movements for a patient.
 */
export async function getPatientLedger(patientId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId || !patientId) return { error: "Unauthorized or missing ID" };

    try {
        const lines = await prisma.journal_entry_lines.findMany({
            where: {
                tenant_id: session.user.tenantId,
                company_id: companyId,
                partner_id: patientId
            },
            include: {
                journal_entries: {
                    select: {
                        date: true,
                        ref: true,
                        journals: { select: { name: true, code: true } }
                    }
                },
                accounts: { select: { name: true, code: true } }
            },
            orderBy: {
                journal_entries: { date: 'desc' }
            }
        });

        return { success: true, data: serialize(lines) };
    } catch (error: any) {
        console.error("Patient Ledger Fetch Failed:", error);
        return { error: "Could not fetch patient ledger" };
    }
}

const REG_FEE_DESCRIPTION = "Patient Registration Fee";

export async function generateRegistrationInvoice(patientId: string, appointmentId?: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    let companyId = session?.user?.companyId;

    if (!tenantId) return { error: "SECURITY_AUTH_EXPIRED: Please login to verify clinical credentials." };

    if (!companyId) {
        const fallback = await prisma.company.findFirst({
            where: { tenant_id: tenantId, enabled: true }
        });
        companyId = fallback?.id ?? null;
    }
    if (!companyId) return { error: "FACILITY_UNLINKED: Billing terminal lacks active branch association." };

    try {
        const invoice = await prisma.$transaction(async (tx) => {
            // [ATOMIC-GUARD] Use Postgres Advisory Lock to prevent concurrent registration billing for this patient
            await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext(\'${patientId}_reg\'))`);

            // [IDEMPOTENCY-FIX] Nuclear Match Check for existing registration invoice
            const existing = await tx.hms_invoice.findFirst({
                where: {
                    OR: [
                        appointmentId ? { appointment_id: appointmentId } : {},
                        { patient_id: patientId }
                    ],
                    tenant_id: tenantId,
                    status: { in: ['draft', 'posted', 'paid'] as any[] },
                    hms_invoice_lines: {
                        some: {
                            OR: [
                                { description: { contains: 'Reg', mode: 'insensitive' } },
                                { description: { contains: 'Registration', mode: 'insensitive' } },
                                { description: { contains: 'Identity', mode: 'insensitive' } }
                            ]
                        }
                    }
                },
                select: {
                    id: true,
                    invoice_number: true,
                    status: true,
                    total: true,
                    hms_invoice_lines: {
                        select: { id: true, description: true, net_amount: true, unit_price: true }
                    }
                },
                orderBy: { created_at: 'desc' }
            });

            if (existing) {
                console.log(`[RCM] Duplicate registration invoice blocked for patient ${patientId}. Reusing ${existing.invoice_number}`);
                return existing;
            }

            // 1. Resolve Settings for Registration Fee (from 'registration_config')
            const settings = await tx.hms_settings.findFirst({
                where: { company_id: companyId, key: 'registration_config' }
            });
            const config = (settings?.value as any) || {};
            const regFee = config.fee || 150;
            const regProductId = config.productId;

            // 2. Resolve Product (Registration Fee)
            let product = null;
            if (regProductId) {
                product = await tx.hms_product.findUnique({ where: { id: regProductId } });
            }

            if (!product) {
                product = await tx.hms_product.findFirst({
                    where: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: { contains: 'Registration Fee', mode: 'insensitive' }
                    }
                });
            }

            // Auto-create product if missing (Self-healing)
            if (!product) {
                product = await tx.hms_product.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: "Patient Registration Fee",
                        sku: "REG-FEE",
                        is_service: true,
                        price: regFee,
                        is_active: true
                    }
                });
            }

            // 3. Generate Official Invoice Number
            // NOTE: getNextVoucherNumber uses Prisma internally, if called here it might dead-lock or fail
            // if not passed the transaction client. But since it's a separate async call, we'll risk it or 
            // wrap it if possible. For now, using the standard pattern.
            const invNoRes = await getNextVoucherNumber();
            const invoiceNumber = invNoRes.success ? invNoRes.data : `INV-REG-${Date.now().toString().slice(-6)}`;

            // 4. Create Invoice Record with Line Item
            return await tx.hms_invoice.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    patient_id: patientId,
                    appointment_id: appointmentId || null,
                    invoice_number: invoiceNumber,
                    // [WORLD STANDARD] Use hospital timezone-aware date
                    issued_at: await getHospitalNow(), 
                    subtotal: product.price || 0,
                    total_tax: 0,
                    total: product.price || 0,
                    outstanding_amount: product.price || 0,
                    status: 'posted',
                    billing_metadata: {
                        source: 'auto-registration-rcm',
                        description: 'Automatic registration billing sequence'
                    },
                    branch_id: session.user.current_branch_id,
                    created_by: session.user.id,
                    hms_invoice_lines: {
                        create: {
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            line_idx: 1,
                            product_id: product.id,
                            description: REG_FEE_DESCRIPTION,
                            quantity: 1,
                            unit_price: product.price || 0,
                            net_amount: product.price || 0
                        }
                    }
                },
                select: {
                    id: true,
                    invoice_number: true,
                    status: true,
                    total: true,
                    hms_invoice_lines: {
                        select: { id: true, description: true, net_amount: true, unit_price: true }
                    },
                    hms_patient: {
                        select: { id: true, first_name: true, last_name: true }
                    }
                }
            });
        }, { timeout: 15000 });

        return { success: true, data: serialize(invoice) };
    } catch (err: any) {
        console.error("FAILED_TO_GENERATE_REG_INVOICE:", err);
        return { error: err.message || "RCM_FAILURE: Could not generate auto-billing record." };
    }
}

export async function getOpenRegistrationInvoice(patientId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { error: "Unauthorized" };

    try {
        const invoice = await prisma.hms_invoice.findFirst({
            where: {
                patient_id: patientId,
                tenant_id: tenantId,
                status: { in: ['draft', 'posted'] },
                hms_invoice_lines: {
                    some: {
                        OR: [
                            { description: { contains: 'Reg', mode: 'insensitive' } },
                            { description: { contains: 'Registration', mode: 'insensitive' } },
                            { description: { contains: 'Identity', mode: 'insensitive' } }
                        ]
                    }
                }
            },
            select: {
                id: true,
                invoice_number: true,
                status: true,
                total: true,
                hms_invoice_lines: {
                    select: { id: true, description: true, net_amount: true, unit_price: true }
                },
                hms_patient: {
                    select: { id: true, first_name: true, last_name: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        return { success: true, data: serialize(invoice) };
    } catch (err: any) {
        return { error: err.message };
    }
}

/**
 * [RCM] Generate Consultation Invoice
 * Creates a linked invoice for clinical consultation services.
 */
export async function generateConsultationInvoice(appointmentId: string) {
    const session = await auth();
    if (!session?.user?.tenantId) return { error: "Unauthorized" };
    const tenantId = session.user.tenantId;
    const companyId = session.user.companyId || tenantId;

    try {
        const appointment = await prisma.hms_appointments.findUnique({
            where: { id: appointmentId },
            include: {
                hms_clinician: true,
                hms_patient: true
            }
        });

        if (!appointment) return { error: "Appointment not found" };

        const consultationFee = Number(appointment.hms_clinician?.consultation_fee) || 0;

        // 1. Check for existing invoice
        // [IDEMPOTENCY-FIX] Enhanced check with tenant scoping
        const existing = await prisma.hms_invoice.findFirst({
            where: {
                OR: [
                    { appointment_id: appointmentId },
                    { encounter_id: appointmentId }
                ],
                tenant_id: tenantId,
                status: { not: 'cancelled' }
            }
        });

        if (existing) {
            console.log(`[RCM] Duplicate consultation invoice blocked for appointment ${appointmentId}. Reusing ${existing.invoice_number}`);
            return { success: true, data: serialize(existing) };
        }

        // 2. Generate Number
        const invNoRes = await getNextVoucherNumber();
        const invoiceNumber = invNoRes.success ? invNoRes.data : `INV-CONS-${Date.now().toString().slice(-6)}`;

        // 3. Create Invoice
        const invoice = await prisma.hms_invoice.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                company_id: companyId,
                patient_id: appointment.patient_id,
                appointment_id: appointmentId,
                invoice_number: invoiceNumber,
                // [WORLD STANDARD] Use hospital timezone-aware date
                issued_at: await getHospitalNow(),
                subtotal: consultationFee,
                total: consultationFee,
                outstanding_amount: consultationFee,
                status: 'draft',
                billing_metadata: {
                    source: 'op-clinical-terminal',
                    encounter_id: appointmentId
                },
                branch_id: session.user.current_branch_id,
                created_by: session.user.id,
                hms_invoice_lines: {
                    create: {
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        line_idx: 1,
                        description: `Consultation Fee - Dr. ${appointment.hms_clinician?.first_name} ${appointment.hms_clinician?.last_name}`,
                        quantity: 1,
                        unit_price: consultationFee,
                        net_amount: consultationFee
                    }
                }
            }
        });

        return { success: true, data: serialize(invoice) };
    } catch (err: any) {
        console.error("Failed to generate reg invoice:", err);
        return { error: err.message || "RCM_FAILURE: Could not generate consultation bill." };
    }
}


/**
 * [RCM] Link Invoice to Appointment
 */
export async function linkInvoiceToAppointment(invoiceId: string, appointmentId: string) {
    const session = await auth();
    if (!session?.user?.tenantId) return { error: "Unauthorized" };

    try {
        await prisma.hms_invoice.update({
            where: { id: invoiceId },
            data: { appointment_id: appointmentId }
        });
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function getInitialInvoiceData(rawAppointmentId: string) {
    const session = await auth();
    if (!session?.user?.tenantId) return { error: "Unauthorized" };
    const tenantId = session.user.tenantId;

    if (!rawAppointmentId || typeof rawAppointmentId !== 'string') {
        console.log("[DEBUG-BILLING] Invalid appointmentId provided:", rawAppointmentId);
        return { error: "Invalid appointment reference." };
    }

    const appointmentId = rawAppointmentId.trim();
    if (!appointmentId) return { error: "Appointment ID cannot be empty." };

    try {
        const appointment = await prisma.hms_appointments.findUnique({
            where: { id: appointmentId },
            include: {
                hms_clinician: true,
                hms_patient: true
            }
        });

        if (!appointment || String(appointment.tenant_id) !== String(tenantId)) {
            return { error: "Appointment not found or access denied" };
        }

        let draftInvoice = await prisma.hms_invoice.findFirst({
            where: {
                OR: [
                    { appointment_id: appointmentId },
                    { encounter_id: appointmentId }
                ],
                status: { in: ['draft', 'posted'] as any[] }
            },
            include: {
                hms_invoice_lines: {
                    include: { hms_product: true }
                },
                hms_patient: true
            }
        });

        // 1. Consultation Hub (Respect Master Switch)
        const configRes = await getHMSSettings();
        const configData = configRes.success ? configRes.settings : {};
        const isConsultationDisabled = !!(configData as any).disableConsultationBilling;

        const consultationItems: any[] = [];
        if (!isConsultationDisabled) {
             const consultationBillingMode = (configData as any).consultationBillingMode || 'post_visit';
             const consultationFee = Number(appointment.hms_clinician?.consultation_fee || 0);
             let shouldAddConsultation = (consultationBillingMode === 'at_booking') || !['scheduled', 'arrived'].includes(appointment.status);

             if (consultationFee > 0 && shouldAddConsultation) {
                 const hasConsultation = draftInvoice?.hms_invoice_lines.some(l => l.description?.includes('Consultation Fee'));
                 if (!hasConsultation) {
                     consultationItems.push({
                         id: appointment.clinician_id,
                         name: `Consultation Fee - Dr. ${appointment.hms_clinician?.first_name}`,
                         price: consultationFee,
                         quantity: 1,
                         type: 'service',
                         source: 'consultation',
                         sourceId: appointmentId
                     });
                 }
             }
        }

        // 2. Nursing Hub (Confirmed & Pending Consumables)
        const nursingMoves = await prisma.hms_stock_move.findMany({
            where: {
                source_reference: appointmentId,
                tenant_id: tenantId as any,
                source: { in: ['Nursing Consumption', 'Nursing Consumption (Confirmed)', 'Nursing Consumption (Pending)', 'confirmed'] }
            }
        });

        const nursingProductIds = [...new Set(nursingMoves.map(m => m.product_id))];
        const nursingProducts = await prisma.hms_product.findMany({
            where: { id: { in: nursingProductIds } }
        });
        const productMap = new Map(nursingProducts.map(p => [p.id, p]));

        const nursingItems = nursingMoves.map(m => {
            const product = productMap.get(m.product_id);
            const finalPrice = Number(m.cost || product?.price || 0);
            const isPending = m.source === 'Nursing Consumption (Pending)';
            
            return {
                id: m.product_id,
                name: (product?.name || 'Consumable') + (isPending ? ' (Draft)' : ''),
                quantity: Math.abs(Number(m.qty || 1)),
                unit_price: finalPrice,
                price: finalPrice,
                type: 'item',
                source: 'nursing',
                sourceId: m.id,
                isPending: isPending
            };
        });

        // 3. Doctor Hub (Prescriptions)
        const prescriptions = await (prisma as any).prescription.findMany({
            where: {
                OR: [{ appointment_id: appointmentId }, { patient_id: appointment.patient_id }],
                tenant_id: tenantId as any
            },
            take: 5,
            orderBy: { created_at: 'desc' }
        });

        const prescriptionItems: any[] = [];
        for (const p of prescriptions) {
            const itemsRaw = await (prisma as any).prescription_items.findMany({
                where: { prescription_id: p.id }
            });
            const pIds = [...new Set(itemsRaw.map((i: any) => i.medicine_id))].filter(Boolean);
            const prods = pIds.length > 0 ? await (prisma as any).hms_product.findMany({ where: { id: { in: pIds as string[] } } }) : [];
            const pMap = new Map(prods.map((pr: any) => [pr.id, pr]));

            (itemsRaw as any[]).forEach((item: any) => {
                const product = (pMap.get(item.medicine_id) as any) || {};
                const totalQty = (Number(item.morning || 0) + Number(item.afternoon || 0) + Number(item.evening || 0) + Number(item.night || 0)) * Number(item.days || 1);
                prescriptionItems.push({
                    id: item.medicine_id || `rx-${item.id}`,
                    name: (product as any).name || item.medicine_name || `Prescribed Medicine`,
                    quantity: totalQty || 1,
                    unit_price: Number((product as any).price || 0),
                    price: Number((product as any).price || 0),
                    type: 'item',
                    source: 'doctor',
                    sourceId: item.id
                });
            });
        }

        // 4. Lab Hub (Investigations)
        const labOrders = await (prisma as any).hms_lab_order.findMany({
            where: {
                OR: [{ encounter_id: appointmentId }, { patient_id: appointment.patient_id }],
                tenant_id: tenantId,
                status: { not: 'cancelled' }
            },
            include: {
                hms_lab_order_line: { include: { hms_lab_test: true } },
                hms_lab_order_lines: { include: { hms_lab_test: true } }
            }
        });

        const labItems = labOrders.flatMap((order: any) => {
            const singular = order.hms_lab_order_line || [];
            const plural = order.hms_lab_order_lines || [];
            const allLines = [...singular, ...plural];

            return allLines.map((line: any) => {
                const finalPrice = Number(line.price || (line.hms_lab_test as any)?.price || 0);
                return {
                    id: line.test_id || line.id,
                    name: (line.hms_lab_test as any)?.name || 'Lab Test',
                    quantity: 1,
                    unit_price: finalPrice,
                    price: finalPrice,
                    type: 'service',
                    source: 'lab',
                    sourceId: line.id
                };
            });
        });

        // 5. Registration Hub
        const regItems: any[] = [];
        const registrationPaid = (appointment.hms_patient?.metadata as any)?.registration_fees_paid;
        if (!registrationPaid) {
            const regFeeRecord = await prisma.hms_patient_registration_fees.findFirst({
                where: { tenant_id: tenantId, is_active: true }
            });
            if (regFeeRecord && !draftInvoice?.hms_invoice_lines.some(l => l.description?.toLowerCase().includes('registration'))) {
                regItems.push({
                    id: 'reg-fee',
                    name: 'Patient Registration Fee',
                    price: Number(regFeeRecord.fee_amount),
                    quantity: 1,
                    type: 'service',
                    source: 'registration',
                    sourceId: 'fixed'
                });
            }
        }

        // Deduplicate and Prepare Hubs for Sidebar
        const hubs = [
            // { id: 'consult', label: 'Consultations', items: consultationItems, icon: 'User' },
            { id: 'doctor', label: 'Doctor Hub', items: prescriptionItems, icon: 'Package' },
            { id: 'lab', label: 'Lab Hub', items: labItems, icon: 'Activity' },
            { id: 'nurse', label: 'Nursing Hub', items: nursingItems, icon: 'Zap' },
            { id: 'reg', label: 'Registration Hub', items: regItems, icon: 'ShieldCheck' }
        ].filter(h => h.items.length > 0);

        // Prepare flat list for auto-inject (Legacy support)
        const allItems = [...consultationItems, ...nursingItems, ...prescriptionItems, ...labItems, ...regItems];

        const pendingCount = await prisma.hms_stock_move.count({
            where: { source_reference: appointmentId, tenant_id: tenantId as any, source: 'Nursing Consumption (Pending)' }
        });

        return {
            success: true,
            data: serialize({
                hubs,
                initialItems: allItems,
                initialInvoice: draftInvoice,
                patientId: appointment.patient_id,
                pendingConsumablesCount: pendingCount
            })
        };

    } catch (error: any) {
        console.error("getInitialInvoiceData error:", error);
        return { error: error.message };
    }
}

// Helper to JIT Create/Resolve Tax Rates
async function resolveAutoTax(rate: number, tenant_id: string, company_id: string): Promise<string | null> {
    if ((!rate && rate !== 0)) return null;
    try {
        // 1. Find existing rate in GLOBAL rates first
        const map = await prisma.company_tax_maps.findFirst({
            where: { company_id, tax_rates: { rate: rate } },
            include: { tax_rates: true }
        });
        if (map && map.tax_rates) return map.tax_rates.id;

        // 2. Find any rate with matching value
        let existing = await prisma.tax_rates.findFirst({ where: { rate: rate, is_active: true } });

        if (existing) {
            const alreadyMapped = await prisma.company_tax_maps.findFirst({ where: { company_id, tax_rate_id: existing.id } });
            if (!alreadyMapped) {
                const mapData: any = {
                    id: crypto.randomUUID(),
                    tenant_id,
                    company_id,
                    tax_rate_id: existing.id,
                    tax_type_id: existing.tax_type_id,
                    is_default: false
                };
                await prisma.company_tax_maps.create({ data: mapData }).catch(e => console.error("Map create fail", e));
            }
            return existing.id;
        }

        // 3. Create NEW Type & Rate
        const typeName = `AUTO_GST_${rate}`;
        let taxType = await prisma.tax_types.findFirst({ where: { name: typeName } });

        if (!taxType) {
            const typeData: any = {
                id: crypto.randomUUID(),
                name: typeName,
                description: `Auto Generated ${rate}%`,
                is_active: true
            };
            try {
                taxType = await prisma.tax_types.create({ data: typeData });
            } catch (e) {
                taxType = await prisma.tax_types.findFirst({ where: { name: 'GST' } });
            }
        }

        if (!taxType) return null;

        const rateData: any = {
            id: crypto.randomUUID(),
            tax_type_id: taxType.id,
            name: `${rate}%`,
            rate: rate,
            is_active: true
        };
        const newRate = await prisma.tax_rates.create({ data: rateData });

        const mapData: any = {
            id: crypto.randomUUID(),
            tenant_id,
            company_id,
            tax_rate_id: newRate.id,
            tax_type_id: taxType.id,
            is_default: false
        };
        await prisma.company_tax_maps.create({ data: mapData }).catch(e => { });

        return newRate.id;
    } catch (e) {
        console.error("Auto Tax Resolve Error:", e);
        return null;
    }
}


// Helper for unified registration tracking
async function trackRegistrationPayment(tx: any, patientId: string, tenantId: string, companyId: string) {
    try {
        // [IDEMPOTENCY-FIX] Check if patient is already active and valid
        const patient = await tx.hms_patient.findUnique({
            where: { id: patientId },
            select: { metadata: true }
        });
        if (!patient) return;

        const currentMeta = (patient.metadata as any) || {};
        const now = new Date();

        // If they already have an expiry in the future, don't update (avoid flapping or nested transactional loops)
        if (currentMeta.registration_fees_paid === true && currentMeta.registration_expiry) {
            const expiry = new Date(currentMeta.registration_expiry);
            if (expiry > now) {
                console.log(`[REG-TRACK] Skipping update for patient ${patientId}. Existing valid registration until ${currentMeta.registration_expiry}`);
                return;
            }
        }

        // 1. Get validity period from settings
        const hmsConfigRecord = await tx.hms_settings.findFirst({
            where: { company_id: companyId, tenant_id: tenantId, key: 'registration_config' }
        });
        const configData = (hmsConfigRecord?.value as any) || {};

        // Fallback to history check if config is missing
        const activeFee = await tx.hms_patient_registration_fees.findFirst({
            where: { tenant_id: tenantId, company_id: companyId, is_active: true }
        });

        const validityDays = activeFee?.validity_days || configData.validity || 7;

        // 2. Calculate expiry
        const expiryDate = new Date();
        expiryDate.setDate(now.getDate() + validityDays);

        // 3. Update Patient Metadata (using the already fetched patient object)
        await tx.hms_patient.update({
            where: { id: patientId },
            data: {
                metadata: {
                    ...currentMeta,
                    registration_fees_paid: true,
                    registration_fee_date: now.toISOString(),
                    registration_expiry: expiryDate.toISOString(),
                    status: 'active' // Clear 'awaiting_payment' if present
                }
            }
        });
        console.log(`[REG-TRACK] Updated patient ${patientId} registration. Expiry: ${expiryDate.toISOString()}`);
    } catch (err) {
        console.error("[REG-TRACK] Failed to update patient registration status", err);
    }
}

export async function getAppointmentBillingStatus(appointmentId: string) {
    const session = await auth();
    if (!session?.user?.tenantId) return { error: "Unauthorized" };
    const tenantId = session.user.tenantId;

    try {
        const appointment = await prisma.hms_appointments.findUnique({
            where: { id: appointmentId },
            include: {
                hms_clinician: true,
                hms_patient: true,
                hms_invoice: {
                    include: {
                        hms_invoice_lines: true
                    }
                }
            }
        });

        if (!appointment) return { error: "Appointment not found" };

        const invoice = appointment.hms_invoice?.[0] || null;

        return {
            success: true,
            data: serialize({
                appointment,
                invoice,
                status: invoice?.status || 'unbilled'
            })
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getPatientActiveAppointmentForBilling(patientId: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const tenantId = session.user.tenantId;

    try {
        if (!patientId || patientId === 'undefined') return { success: true, appointmentId: null, pendingCount: 0 };

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const recentAppointments = await (prisma as any).hms_appointments.findMany({
            where: {
                patient_id: patientId,
                tenant_id: tenantId,
                starts_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            select: { id: true }
        });

        const apptIds = recentAppointments.map((a: any) => a.id);
        if (apptIds.length === 0) return { success: true, appointmentId: null, pendingCount: 0 };

        const pendingMoves = await (prisma as any).hms_stock_move.findMany({
            where: {
                source_reference: { in: apptIds },
                source: 'Nursing Consumption (Pending)'
            },
            select: { id: true, qty: true, uom: true, product_id: true, created_at: true }
        });

        // Resolve product names
        const productIds = pendingMoves.map((m: any) => m.product_id);
        const products = await (prisma as any).hms_product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true }
        });
        const productMap = new Map(products.map((p: any) => [p.id, p.name]));

        const itemsWithNames = pendingMoves.map((m: any) => ({
            id: m.id,
            name: productMap.get(m.product_id) || `Item ID: ${m.product_id.slice(0, 8)}`,
            qty: Number(m.qty),
            uom: m.uom,
            timestamp: m.created_at
        }));

        return {
            success: true,
            appointmentId: apptIds[0],
            pendingCount: pendingMoves.length,
            pendingItems: itemsWithNames
        };
    } catch (err: any) {
        console.error("[BILLING-ACTION] Failed to fetch active context:", err);
        return { error: err.message };
    }
}
