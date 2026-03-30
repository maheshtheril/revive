'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { AccountingService } from '@/lib/services/accounting'

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

            // 2. Calculate Totals
            let totalAmount = 0;
            for (const item of data.items) {
                totalAmount += (item.qtyToReturn * item.unitPrice);
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
                    total_amount: totalAmount,
                    status: 'draft',
                    created_by: session.user.id
                }
            })

            // 4. Create Lines & Update Stock
            for (const item of data.items) {
                await tx.hms_purchase_return_line.create({
                    data: {
                        tenant_id: session.user.tenantId!,
                        company_id: companyId,
                        return_id: pReturn.id,
                        receipt_line_id: item.receiptLineId,
                        product_id: item.productId,
                        qty: item.qtyToReturn,
                        unit_price: item.unitPrice,
                        line_total: item.qtyToReturn * item.unitPrice,
                        batch_id: item.batchId,
                        batch_no: item.batchNo
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

                if (receiptLine?.location_id) {
                    const existingStock = await tx.hms_stock_levels.findFirst({
                        where: {
                            company_id: companyId,
                            product_id: item.productId,
                            location_id: receiptLine.location_id
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
            return { success: true, data: result, warning: `Return created but accounting failed: ${accResult.error}` };
        }

        revalidatePath('/hms/purchasing/receipts');
        revalidatePath(`/hms/purchasing/receipts/${data.receiptId}`);
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Purchase Return Error:", error);
        return { error: error.message || "Failed to process return" }
    }
}

export type SalesReturnData = {
    invoiceId: string
    patientId: string
    reason?: string
    items: {
        invoiceLineId: string
        productId?: string | null
        qtyToReturn: number
        unitPrice: number
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

            const sReturn = await tx.hms_sales_return.create({
                data: {
                    tenant_id: session.user.tenantId!,
                    company_id: companyId,
                    invoice_id: data.invoiceId,
                    patient_id: data.patientId,
                    return_number: returnNumber,
                    reason: data.reason,
                    total_amount: totalAmt,
                    status: 'draft',
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
                        line_total: item.qtyToReturn * item.unitPrice
                    }
                })

                if (item.productId) {
                    // STOCK LEDGER (Inward) - Unified
                    await tx.hms_stock_ledger.create({
                        data: {
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: item.productId,
                            movement_type: 'sale_return',
                            qty: item.qtyToReturn,
                            uom: 'Unit', // Fallback for returns if unknown
                            unit_cost: item.unitPrice, // Cost for return
                            to_location_id: null, // Should resolve default if possible
                            reference: returnNumber,
                            related_type: 'hms_sales_return',
                            related_id: sReturn.id,
                            metadata: { invoice_id: data.invoiceId }
                        }
                    })

                    // [LEGACY] Keep for old Reports
                    await tx.hms_product_stock_ledger.create({
                        data: {
                            tenant_id: session.user.tenantId!,
                            company_id: companyId,
                            product_id: item.productId,
                            movement_type: 'sale_return',
                            change_qty: item.qtyToReturn,
                            balance_qty: 0,
                            reference: returnNumber,
                            cost: 0,
                            metadata: { invoice_id: data.invoiceId }
                        }
                    })

                    let level = await tx.hms_stock_levels.findFirst({
                        where: { company_id: companyId, product_id: item.productId }
                    })
                    if (level) {
                        await tx.hms_stock_levels.update({
                            where: { id: level.id },
                            data: { quantity: { increment: item.qtyToReturn } }
                        })
                    }
                }
            }
            return sReturn;
        })

        await AccountingService.postSalesReturn(result.id, session.user.id);
        revalidatePath('/hms/billing/invoices');
        return { success: true, data: result };
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
        return { success: true, data: result };
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
        return { success: true, data: ret };
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
        return { success: true, data: ret };
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
