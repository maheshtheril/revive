'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { serialize } from '@/lib/utils'

/**
 * Fetches the transactional stock ledger for a specific period/product.
 * Designed for Tally ERP-style viewing.
 */
export async function getStockLedgerReport(filters: {
    productId?: string;
    startDate?: string;
    endDate?: string;
    movementType?: 'in' | 'out';
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    if (!companyId) return { success: false, error: "Unauthorized" };

    try {
        const where: any = { company_id: companyId };
        
        if (filters.productId && filters.productId !== 'ALL') {
            where.product_id = filters.productId;
        }
        
        if (filters.startDate || filters.endDate) {
            where.created_at = {};
            if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
            if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
        }

        if (filters.movementType) {
            where.movement_type = filters.movementType;
        }

        const entries = await prisma.hms_stock_ledger.findMany({
            where,
            include: {
                hms_product: {
                    select: { name: true, sku: true, uom: true }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 1000 // Tally style usually has a lot of rows
        });

        // Serialization fix for Decimal objects in hms_stock_ledger
        return { success: true, data: serialize(entries) };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Surgically updates a stock ledger entry and synchronizes the real stock levels.
 */
export async function updateStockLedgerEntry(id: string, newQty: number, reason: string) {
    const session = await auth();
    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.isAdmin;
    if (!isAdmin) return { success: false, error: "Unauthorized. Admin access required." };

    try {
        return await prisma.$transaction(async (tx) => {
            const entry = await tx.hms_stock_ledger.findUnique({
                where: { id },
                include: { hms_product: true }
            });

            if (!entry) throw new Error("Entry not found");

            const oldQty = Number(entry.qty);
            const delta = newQty - oldQty;

            // Determine if this movement added to or removed from stock
            const isInbound = ['in', 'purchase', 'adjustment_in', 'opening_stock', 'return_in'].includes(entry.movement_type);

            // Update the ledger entry itself
            await tx.hms_stock_ledger.update({
                where: { id },
                data: {
                    qty: newQty,
                    reference: `${entry.reference} (Edited: ${reason})`
                }
            });

            // Synchronize Stock Levels and Batches
            // Adjustment should be based on delta and direction
            // If it was IN: adding 5 means stock +5.
            // If it was OUT: removing 5 more means stock -5.
            const stockAdjustment = isInbound ? delta : -delta;

            if (entry.batch_id) {
                await tx.hms_product_batch.update({
                    where: { id: entry.batch_id },
                    data: { qty_on_hand: { increment: stockAdjustment } }
                });

                await tx.hms_stock_levels.updateMany({
                    where: {
                        product_id: entry.product_id,
                        batch_id: entry.batch_id,
                        location_id: entry.to_location_id || entry.from_location_id as string
                    },
                    data: { quantity: { increment: stockAdjustment } }
                });
            }

            return { success: true };
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Removes a stock ledger entry and reverts its impact on stock levels.
 */
export async function deleteStockLedgerEntry(id: string) {
    const session = await auth();
    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.isAdmin;
    if (!isAdmin) return { success: false, error: "Access Denied" };

    try {
        return await prisma.$transaction(async (tx) => {
            const entry = await tx.hms_stock_ledger.findUnique({ where: { id } });
            if (!entry) throw new Error("Entry not found");

            const isInbound = ['in', 'purchase', 'adjustment_in', 'opening_stock', 'return_in'].includes(entry.movement_type);
            const revertQty = isInbound ? -Number(entry.qty) : Number(entry.qty);

            if (entry.batch_id) {
                await tx.hms_product_batch.update({
                    where: { id: entry.batch_id },
                    data: { qty_on_hand: { increment: revertQty } }
                });

                await tx.hms_stock_levels.updateMany({
                    where: {
                        product_id: entry.product_id,
                        batch_id: entry.batch_id,
                        location_id: entry.to_location_id || entry.from_location_id as string
                    },
                    data: { quantity: { increment: revertQty } }
                });
            }

            await tx.hms_stock_ledger.delete({ where: { id } });
            return { success: true };
        });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
