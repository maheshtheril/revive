'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

/**
 * Sweeps the entire stock ledger to ensure all batch costs reflect the true landed cost.
 * This fixes the "silly" logic where discounts were ignored.
 */
export async function repairStockQuantities() {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { success: false, error: "Unauthorized" };

    const companyId = session.user.companyId;

    try {
        // 1. Get all Stock Levels grouped by Batch
        const stockBuckets = await prisma.hms_stock_levels.groupBy({
            by: ['batch_id'],
            where: {
                company_id: companyId,
                batch_id: { not: null }
            },
            _sum: {
                quantity: true
            }
        });

        let healedCount = 0;

        // 2. Sync the Batch table with the true level sum
        for (const bucket of stockBuckets) {
            if (!bucket.batch_id) continue;

            await prisma.hms_product_batch.update({
                where: { id: bucket.batch_id },
                data: {
                    qty_on_hand: bucket._sum.quantity || 0
                }
            });
            healedCount++;
        }

        revalidatePath('/hms/inventory/reports/stock');
        return { success: true, message: `Stock quantities synchronized for ${healedCount} batches.` };

    } catch (err: any) {
        console.error("Healer Error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Repairs 0-priced batches by pulling values from Product Master.
 * Essential for legacy imports where prices were only in the Master record.
 */
export async function repairMissingPrices() {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { success: false, error: "Unauthorized" };

    const companyId = session.user.companyId;

    try {
        const batches = await prisma.hms_product_batch.findMany({
            where: {
                company_id: companyId,
                OR: [
                    { mrp: { lte: 0 } },
                    { cost: { lte: 0 } },
                    { sale_price: { lte: 0 } }
                ]
            },
            include: {
                hms_product: true
            }
        });

        let repairedCount = 0;

        for (const batch of batches) {
            const product = batch.hms_product;
            const meta = (product.metadata as any) || {};
            
            // Derive prices
            const mrp = (batch.mrp?.toNumber() || 0) > 0 ? batch.mrp : (meta.mrp || 0);
            const cost = (batch.cost?.toNumber() || 0) > 0 ? batch.cost : (meta.cost_price || meta.purchase_price || 0);
            const sale = (batch.sale_price?.toNumber() || 0) > 0 ? batch.sale_price : (product.price || meta.last_sale_price || 0);

            if (mrp > 0 || cost > 0 || sale > 0) {
                await prisma.hms_product_batch.update({
                    where: { id: batch.id },
                    data: {
                        mrp: Number(mrp),
                        cost: Number(cost),
                        sale_price: Number(sale)
                    }
                });
                repairedCount++;
            }
        }

        revalidatePath('/hms/inventory/reports/stock');
        return { success: true, message: `Pricing data repaired for ${repairedCount} batches.` };

    } catch (err: any) {
        console.error("Price Repair Error:", err);
        return { success: false, error: err.message };
    }
}
