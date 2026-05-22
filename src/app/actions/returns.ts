'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { AccountingService } from '@/lib/services/accounting'
import { serialize } from '@/lib/utils'

export type PurchaseReturnData = {
    receiptId: string
    supplierId: string
    reason?: string
    items: {
        receiptLineId: string
        productId: string
        qtyToReturn: number
        unitPrice: number
        batchId?: string
        batchNo?: string
        taxRate?: number
        taxAmount?: number
    }[]
}

export async function createPurchaseReturn(data: PurchaseReturnData) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" }
    const companyId = session.user.companyId;

    if (!data.items || data.items.length === 0) return { error: "Return must have items" }

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Generate Return Number
            const count = await tx.hms_purchase_return.count({ where: { company_id: companyId } })
            const returnNumber = `PRT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

            // 2. Calculate Totals with GST Tax Breakdown
            let subtotal = 0;
            let totalTax = 0;
            let totalAmount = 0;

            for (const item of data.items) {
                const lineSub = item.qtyToReturn * item.unitPrice;
                const lineTax = item.taxAmount ?? (lineSub * ((item.taxRate ?? 0) / 100));
                subtotal += lineSub;
                totalTax += lineTax;
                totalAmount += lineSub + lineTax;
            }

            // 3. Create Return Header
            const pReturn = await tx.hms_purchase_return.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: companyId,
                    receipt_id: data.receiptId,
                    supplier_id: data.supplierId,
                    return_number: returnNumber,
                    reason: data.reason,
                    subtotal: subtotal,
                    total_tax: totalTax,
                    total_amount: totalAmount,
                    status: 'draft',
                    created_by: session.user.id
                }
            })

            // 3.5 INVENTORY AUDIT GUARD: VERIFY BATCH STOCK ON HAND
            for (const item of data.items) {
                if (item.batchId) {
                    const batch = await tx.hms_product_batch.findUnique({ where: { id: item.batchId } });
                    if (!batch || Number(batch.qty_on_hand) < item.qtyToReturn) {
                        throw new Error(`INVENTORY AUDIT BLOCK: Cannot return ${item.qtyToReturn} units of batch ${item.batchNo || item.batchId}. Only ${batch ? batch.qty_on_hand : 0} units remain in stock. The rest have already been sold or dispensed.`);
                    }
                }
            }

            // 4. Create Lines & Update Stock
            for (const item of data.items) {
                const lineSub = item.qtyToReturn * item.unitPrice;
                const lineTax = item.taxAmount ?? (lineSub * ((item.taxRate ?? 0) / 100));

                await tx.hms_purchase_return_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        return_id: pReturn.id,
                        receipt_line_id: item.receiptLineId,
                        product_id: item.productId,
                        qty: item.qtyToReturn,
                        unit_price: item.unitPrice,
                        tax_amount: lineTax,
                        line_total: lineSub + lineTax,
                        batch_id: item.batchId,
                        batch_no: item.batchNo,
                        metadata: { tax_rate: item.taxRate ?? 0 }
                    }
                })

                // UPDATE STOCK LEVELS
                const receiptLine = await tx.hms_purchase_receipt_line.findUnique({
                    where: { id: item.receiptLineId }
                });

                // STOCK LEDGER (Outward) - Unified
                await tx.hms_stock_ledger.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'purchase_return',
                        qty: -item.qtyToReturn,
                        uom: receiptLine?.uom || 'Unit',
                        unit_cost: item.unitPrice,
                        total_cost: item.qtyToReturn * item.unitPrice,
                        from_location_id: receiptLine?.location_id,
                        batch_id: item.batchId,
                        reference: returnNumber,
                        related_type: 'hms_purchase_return',
                        related_id: pReturn.id
                    }
                })

                // [LEGACY] Keep for old Reports until migration
                await tx.hms_product_stock_ledger.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'return',
                        change_qty: -item.qtyToReturn, // Negative for return
                        balance_qty: 0, // Simplified
                        reference: returnNumber,
                        cost: item.unitPrice,
                        batch_id: item.batchId,
                        metadata: {
                            related_type: 'purchase_return',
                            related_id: pReturn.id
                        }
                    }
                })

                const locationId = receiptLine?.location_id || (await tx.hms_stock_location.findFirst({ where: { company_id: companyId } }))?.id;
                if (locationId) {
                    const existingStock = await tx.hms_stock_levels.findFirst({
                        where: {
                            company_id: companyId,
                            product_id: item.productId,
                            location_id: locationId
                        }
                    });

                    if (existingStock) {
                        await tx.hms_stock_levels.update({
                            where: { id: existingStock.id },
                            data: {
                                quantity: { decrement: item.qtyToReturn }
                            }
                        });
                    }
                }

                // Update batch stock if exists
                if (item.batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: item.batchId },
                        data: { qty_on_hand: { decrement: item.qtyToReturn } }
                    })
                }
            }

            return pReturn;
        })

        // 5. Post to Accounting
        const accResult = await AccountingService.postPurchaseReturn(result.id, session.user.id);

        if (!accResult.success) {
            return { success: true, data: serialize(result), warning: `Return created but accounting failed: ${accResult.error}` };
        }

        revalidatePath('/hms/purchasing/receipts');
        revalidatePath(`/hms/purchasing/receipts/${data.receiptId}`);
        return { success: true, data: serialize(result) };
    } catch (error: any) {
        console.error("Purchase Return Error:", error);
        return { error: error.message || "Failed to process return" }
    }
}

export type SalesReturnData = {
    invoiceId: string
    patientId: string
    reason?: string
    refundMethod?: 'credit_note' | 'cash'
    locationId?: string
    items: {
        invoiceLineId: string
        productId: string
        qtyToReturn: number
        unitPrice: number
        batchId?: string
        taxRateId?: string
    }[]
}

export async function createSalesReturn(data: SalesReturnData) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" }
    const companyId = session.user.companyId;

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const count = await tx.hms_sales_return.count({ where: { company_id: companyId } })
            const returnNumber = `SRT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

            let totalAmt = 0;
            data.items.forEach(i => totalAmt += (i.qtyToReturn * i.unitPrice));

            // WORLD CLASS: Resolve Location ID (Handle non-UUID placeholders)
            let resolvedLocationId = data.locationId;
            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            
            if (resolvedLocationId && !isUUID(resolvedLocationId)) {
                const firstLoc = await tx.hms_stock_location.findFirst({
                    where: { company_id: companyId }
                });
                resolvedLocationId = firstLoc?.id || null;
            }

            const sReturn = await tx.hms_sales_return.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: companyId,
                    invoice_id: data.invoiceId,
                    patient_id: data.patientId,
                    return_number: returnNumber,
                    reason: data.reason,
                    total_amount: totalAmt,
                    status: 'posted',
                    metadata: {
                        refund_method: data.refundMethod || 'credit_note',
                        location_id: resolvedLocationId
                    },
                    created_by: session.user.id
                }
            })

            for (const item of data.items) {
                await tx.hms_sales_return_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        return_id: sReturn.id,
                        invoice_line_id: item.invoiceLineId,
                        product_id: item.productId,
                        qty: item.qtyToReturn,
                        unit_price: item.unitPrice,
                        line_total: item.qtyToReturn * item.unitPrice,
                        metadata: { batch_id: item.batchId }
                    }
                })

                // 1. UPDATE BATCH STOCK (Critical for Medical ERP)
                if (item.batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: item.batchId },
                        data: { qty_on_hand: { increment: item.qtyToReturn } }
                    })
                }

                // 2. STOCK LEDGER (Inward)
                await tx.hms_stock_ledger.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'sale_return',
                        qty: item.qtyToReturn,
                        uom: 'Unit',
                        unit_cost: item.unitPrice,
                        to_location_id: resolvedLocationId,
                        batch_id: item.batchId,
                        reference: returnNumber,
                        related_type: 'hms_sales_return',
                        related_id: sReturn.id,
                        metadata: { invoice_id: data.invoiceId }
                    }
                })

                // 3. GLOBAL STOCK LEVEL
                let level = await tx.hms_stock_levels.findFirst({
                    where: { 
                        company_id: companyId, 
                        product_id: item.productId,
                        location_id: resolvedLocationId || undefined
                    }
                })
                if (level) {
                    await tx.hms_stock_levels.update({
                        where: { id: level.id },
                        data: { quantity: { increment: item.qtyToReturn } }
                    })
                } else if (resolvedLocationId) {
                    await tx.hms_stock_levels.create({
                        data: {
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: item.productId,
                            location_id: resolvedLocationId,
                            quantity: item.qtyToReturn
                        }
                    })
                }
            }
            return sReturn;
        }, { timeout: 15000 })

        // 4. POST TO ACCOUNTING
        await AccountingService.postSalesReturn(result.id, session.user.id);
        
        revalidatePath('/hms/billing/returns');
        revalidatePath('/hms/inventory');
        return { success: true, data: serialize(result) };
    } catch (error: any) {
        console.error("Sales Return Error:", error);
        return { error: error.message || "Failed to process sales return" }
    }
}

export type StockAdjustmentData = {
    reason: string
    reasonCode: string // wastage, expiry, audit, damage
    items: {
        productId: string
        locationId: string
        batchId?: string
        currentQty: number
        newQty: number
        unitCost: number
    }[]
}

export async function createStockAdjustment(data: StockAdjustmentData) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" }
    const companyId = session.user.companyId;

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const count = await tx.hms_stock_adjustment.count({ where: { company_id: companyId } })
            const adjNumber = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

            const adj = await tx.hms_stock_adjustment.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: companyId,
                    adj_number: adjNumber,
                    adj_date: new Date(),
                    status: 'draft',
                    reason_code: data.reasonCode,
                    notes: data.reason,
                    created_by: session.user.id
                }
            })

            for (const item of data.items) {
                const diff = item.newQty - item.currentQty;
                if (diff === 0) continue;

                await tx.hms_stock_adjustment_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        adj_id: adj.id,
                        product_id: item.productId,
                        location_id: item.locationId,
                        batch_id: item.batchId,
                        old_qty: item.currentQty,
                        new_qty: item.newQty,
                        diff_qty: diff,
                        unit_cost: item.unitCost
                    }
                })

                const existing = await tx.hms_stock_levels.findFirst({
                    where: { company_id: companyId, product_id: item.productId, location_id: item.locationId }
                })
                if (existing) {
                    await tx.hms_stock_levels.update({
                        where: { id: existing.id },
                        data: { quantity: { increment: diff } }
                    })
                }

                if (item.batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: item.batchId },
                        data: { qty_on_hand: { increment: diff } }
                    })
                }

                await tx.hms_product_stock_ledger.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'adjustment',
                        change_qty: diff,
                        balance_qty: item.newQty,
                        reference: adjNumber,
                        cost: item.unitCost,
                        batch_id: item.batchId,
                        metadata: { reason_code: data.reasonCode }
                    }
                })
            }
            return adj;
        })

        await AccountingService.postStockAdjustment(result.id, session.user.id);
        revalidatePath('/hms/inventory');
        return { success: true, data: serialize(result) };
    } catch (error: any) {
        console.error("Stock Adjustment Error:", error);
        return { error: error.message || "Failed to process adjustment" }
    }
}

export async function getPurchaseReturns() {
    const session = await auth();
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" };

    try {
        const returns = await prisma.hms_purchase_return.findMany({
            where: { company_id: session.user.companyId },
            include: {
                hms_supplier: { select: { name: true } },
                _count: { select: { lines: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        return {
            success: true, data: returns.map(r => ({
                id: r.id,
                returnNumber: r.return_number,
                date: r.return_date,
                supplierName: r.hms_supplier?.name || 'Unknown',
                itemCount: r._count.lines,
                totalAmount: Number(r.total_amount),
                status: r.status,
                reason: r.reason
            }))
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSalesReturns() {
    const session = await auth();
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" };

    try {
        const returns = await prisma.hms_sales_return.findMany({
            where: { company_id: session.user.companyId },
            include: {
                hms_patient: { select: { first_name: true, last_name: true } },
                hms_invoice: { select: { invoice_number: true } },
                _count: { select: { lines: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        return {
            success: true, data: returns.map(r => ({
                id: r.id,
                returnNumber: r.return_number,
                date: r.return_date,
                patientName: `${r.hms_patient?.first_name || ''} ${r.hms_patient?.last_name || ''}`.trim() || 'Guest',
                invoiceNumber: r.hms_invoice?.invoice_number || null,
                itemCount: r._count.lines,
                totalAmount: Number(r.total_amount),
                status: r.status,
                reason: r.reason,
                refundMethod: (r.metadata as any)?.refund_method || 'credit_note'
            }))
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSalesReturn(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" };

    try {
        const ret = await prisma.hms_sales_return.findUnique({
            where: { id },
            include: {
                lines: { include: { hms_product: true, hms_invoice_line: true } },
                hms_patient: true
            }
        });

        if (!ret) return { success: false, error: "Not found" };
        return { success: true, data: serialize(ret) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSalesReturn(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.$transaction(async (tx: any) => {
            const ret = await tx.hms_sales_return.findUnique({
                where: { id },
                include: { lines: true }
            });

            if (!ret) throw new Error("Return not found");
            if (ret.status !== 'draft') throw new Error("Only draft returns can be deleted");

            for (const line of ret.lines) {
                if (line.product_id) {
                    await tx.hms_product_stock_ledger.create({
                        data: {
                            tenant_id: ret.tenant_id,
                            company_id: ret.company_id,
                            product_id: line.product_id,
                            movement_type: 'void_return',
                            change_qty: -Number(line.qty),
                            balance_qty: 0,
                            reference: `VOID-${ret.return_number}`,
                            cost: 0
                        }
                    });

                    const level = await tx.hms_stock_levels.findFirst({
                        where: { company_id: ret.company_id, product_id: line.product_id }
                    });
                    if (level) {
                        await tx.hms_stock_levels.update({
                            where: { id: level.id },
                            data: { quantity: { decrement: Number(line.qty) } }
                        });
                    }
                }
            }
            await tx.hms_sales_return.delete({ where: { id } });
        });

        revalidatePath('/hms/billing/returns');
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function getPurchaseReturn(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" };

    try {
        const ret = await prisma.hms_purchase_return.findUnique({
            where: { id },
            include: {
                lines: { include: { hms_product: true, hms_purchase_receipt_line: true } },
                hms_supplier: true
            }
        });

        if (!ret) return { success: false, error: "Not found" };
        return { success: true, data: serialize(ret) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deletePurchaseReturn(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.$transaction(async (tx: any) => {
            const ret = await tx.hms_purchase_return.findUnique({
                where: { id },
                include: { lines: true }
            });

            if (!ret) throw new Error("Return not found");
            if (ret.status !== 'draft') throw new Error("Only draft returns can be deleted");

            for (const line of ret.lines) {
                if (line.product_id) {
                    if (line.batch_id) {
                        await tx.hms_product_batch.update({
                            where: { id: line.batch_id },
                            data: { qty_on_hand: { increment: Number(line.qty) } }
                        });
                    }

                    await tx.hms_stock_ledger.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: ret.tenant_id,
                            company_id: ret.company_id,
                            product_id: line.product_id,
                            movement_type: 'void_purchase_return',
                            qty: Number(line.qty),
                            uom: 'Unit',
                            unit_cost: Number(line.unit_price),
                            to_location_id: (ret.metadata as any)?.location_id || null,
                            batch_id: line.batch_id,
                            reference: `VOID-${ret.return_number}`,
                            related_type: 'hms_purchase_return',
                            related_id: id
                        }
                    });

                    await tx.hms_product_stock_ledger.create({
                        data: {
                            tenant_id: ret.tenant_id,
                            company_id: ret.company_id,
                            product_id: line.product_id,
                            movement_type: 'void_purchase_return',
                            change_qty: Number(line.qty),
                            balance_qty: 0,
                            reference: `VOID-${ret.return_number}`,
                            cost: 0
                        }
                    });

                    const level = await tx.hms_stock_levels.findFirst({
                        where: { company_id: ret.company_id, product_id: line.product_id }
                    });
                    if (level) {
                        await tx.hms_stock_levels.update({
                            where: { id: level.id },
                            data: { quantity: { increment: Number(line.qty) } }
                        });
                    }
                }
            }
            await tx.hms_purchase_return.delete({ where: { id } });
        });

        revalidatePath('/hms/purchasing/returns');
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function updateSalesReturn(id: string, data: SalesReturnData) {
    const session = await auth()
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" }
    const companyId = session.user.companyId;

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const oldReturn = await tx.hms_sales_return.findUnique({
                where: { id },
                include: { lines: true }
            });

            if (!oldReturn) throw new Error("Return not found");

            // 1. REVERSE OLD STOCK CHANGES
            for (const line of oldReturn.lines) {
                const batchId = (line.metadata as any)?.batch_id;
                const locationId = (oldReturn.metadata as any)?.location_id;

                if (batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: batchId },
                        data: { qty_on_hand: { decrement: line.qty } }
                    });
                }

                // Global Stock Level Reversal
                const level = await tx.hms_stock_levels.findFirst({
                    where: { company_id: companyId, product_id: line.product_id, location_id: locationId || undefined }
                });
                if (level) {
                    await tx.hms_stock_levels.update({
                        where: { id: level.id },
                        data: { quantity: { decrement: line.qty } }
                    });
                }
            }

            // 2. DELETE OLD LINES
            await tx.hms_sales_return_line.deleteMany({ where: { return_id: id } });

            // 3. UPDATE HEADER
            let totalAmt = 0;
            data.items.forEach(i => totalAmt += (i.qtyToReturn * i.unitPrice));

            const updatedReturn = await tx.hms_sales_return.update({
                where: { id },
                data: {
                    reason: data.reason,
                    total_amount: totalAmt,
                    metadata: {
                        ...(oldReturn.metadata as any),
                        refund_method: data.refundMethod || 'credit_note'
                    }
                }
            });

            // 4. CREATE NEW LINES & APPLY NEW STOCK
            for (const item of data.items) {
                await tx.hms_sales_return_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        return_id: id,
                        invoice_line_id: item.invoiceLineId,
                        product_id: item.productId,
                        qty: item.qtyToReturn,
                        unit_price: item.unitPrice,
                        line_total: item.qtyToReturn * item.unitPrice,
                        metadata: { batch_id: item.batchId }
                    }
                });

                if (item.batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: item.batchId },
                        data: { qty_on_hand: { increment: item.qtyToReturn } }
                    });
                }

                // New Stock Ledger Entry (Adjustment Entry)
                await tx.hms_stock_ledger.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'sale_return_edit',
                        qty: item.qtyToReturn,
                        uom: 'Unit',
                        unit_cost: item.unitPrice,
                        to_location_id: (oldReturn.metadata as any)?.location_id,
                        batch_id: item.batchId,
                        reference: `EDIT-${oldReturn.return_number}`,
                        related_type: 'hms_sales_return',
                        related_id: id
                    }
                });

                const level = await tx.hms_stock_levels.findFirst({
                    where: { 
                        company_id: companyId, 
                        product_id: item.productId,
                        location_id: (oldReturn.metadata as any)?.location_id || undefined
                    }
                });
                if (level) {
                    await tx.hms_stock_levels.update({
                        where: { id: level.id },
                        data: { quantity: { increment: item.qtyToReturn } }
                    });
                }
            }

            return updatedReturn;
        }, { timeout: 20000 });

        // 5. RE-POST TO ACCOUNTING
        await AccountingService.postSalesReturn(result.id, session.user.id);
        
        revalidatePath('/hms/billing/returns');
        revalidatePath(`/hms/billing/returns/${id}`);
        revalidatePath('/hms/inventory');
        
        return { success: true, data: serialize(result) };
    } catch (error: any) {
        console.error("Update Sales Return Error:", error);
        return { error: error.message || "Failed to update sales return" }
    }
}

export async function updatePurchaseReturn(id: string, data: PurchaseReturnData) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };
    const companyId = session.user.companyId;

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const oldReturn = await tx.hms_purchase_return.findUnique({
                where: { id },
                include: { lines: true }
            });

            if (!oldReturn) throw new Error("Purchase return not found");

            // 1. REVERSE OLD STOCK DEDUCTIONS
            for (const line of oldReturn.lines) {
                if (line.batch_id) {
                    await tx.hms_product_batch.update({
                        where: { id: line.batch_id },
                        data: { qty_on_hand: { increment: line.qty } }
                    });
                }

                const level = await tx.hms_stock_levels.findFirst({
                    where: { company_id: companyId, product_id: line.product_id }
                });
                if (level) {
                    await tx.hms_stock_levels.update({
                        where: { id: level.id },
                        data: { quantity: { increment: line.qty } }
                    });
                }
            }

            // 2. VERIFY NEW BATCH QUANTITIES
            for (const item of data.items) {
                if (item.batchId) {
                    const batch = await tx.hms_product_batch.findUnique({ where: { id: item.batchId } });
                    if (!batch || Number(batch.qty_on_hand) < item.qtyToReturn) {
                        throw new Error(`INVENTORY AUDIT BLOCK: Cannot return ${item.qtyToReturn} units of batch ${item.batchNo || item.batchId}. Only ${batch ? batch.qty_on_hand : 0} units remain in stock.`);
                    }
                }
            }

            // 3. DELETE OLD LINES
            await tx.hms_purchase_return_line.deleteMany({ where: { return_id: id } });

            // 4. UPDATE HEADER
            let totalAmt = 0;
            data.items.forEach(i => totalAmt += (i.qtyToReturn * i.unitPrice));

            const updatedReturn = await tx.hms_purchase_return.update({
                where: { id },
                data: {
                    reason: data.reason,
                    total_amount: totalAmt,
                    supplier_id: data.supplierId
                }
            });

            // 5. CREATE NEW LINES & APPLY NEW DEDUCTIONS
            for (const item of data.items) {
                await tx.hms_purchase_return_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        return_id: id,
                        receipt_line_id: item.receiptLineId,
                        product_id: item.productId,
                        qty: item.qtyToReturn,
                        unit_price: item.unitPrice,
                        line_total: item.qtyToReturn * item.unitPrice,
                        batch_id: item.batchId,
                        batch_no: item.batchNo
                    }
                });

                if (item.batchId) {
                    await tx.hms_product_batch.update({
                        where: { id: item.batchId },
                        data: { qty_on_hand: { decrement: item.qtyToReturn } }
                    });
                }

                await tx.hms_stock_ledger.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        product_id: item.productId,
                        movement_type: 'purchase_return_edit',
                        qty: -item.qtyToReturn,
                        uom: 'Unit',
                        unit_cost: item.unitPrice,
                        batch_id: item.batchId,
                        reference: `EDIT-${oldReturn.return_number}`,
                        related_type: 'hms_purchase_return',
                        related_id: id
                    }
                });

                const level = await tx.hms_stock_levels.findFirst({
                    where: { company_id: companyId, product_id: item.productId }
                });
                if (level) {
                    await tx.hms_stock_levels.update({
                        where: { id: level.id },
                        data: { quantity: { decrement: item.qtyToReturn } }
                    });
                }
            }

            return updatedReturn;
        }, { timeout: 20000 });

        await AccountingService.postPurchaseReturn(result.id, session.user.id);
        
        revalidatePath('/hms/purchasing/returns');
        revalidatePath(`/hms/purchasing/returns/${id}`);
        revalidatePath('/hms/inventory');
        
        return { success: true, data: serialize(result) };
    } catch (error: any) {
        console.error("Update Purchase Return Error:", error);
        return { error: error.message || "Failed to update purchase return" };
    }
}
