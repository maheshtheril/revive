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
