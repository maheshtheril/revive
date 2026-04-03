'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

/**
 * Sweeps the entire stock ledger to ensure all batch costs reflect the true landed cost.
 * This fixes the "silly" logic where discounts were ignored.
 */
export async function repairBatchCosts() {
    const session = await auth();
    const companyId = session?.user?.companyId;
    if (!companyId) return { success: false, error: "Unauthorized" };

    try {
        // 1. Get all Inbound (Purchase) Ledger entries
        const entries = await prisma.hms_stock_ledger.findMany({
            where: {
                company_id: companyId,
                movement_type: 'in'
            }
        });

        let repairedCount = 0;

        // 2. Map and Sync
        for (const entry of entries) {
            if (!entry.batch_id || !entry.unit_cost) continue;

            // The 'unit_cost' in the ledger *should* be the landed cost if updated via receipt.ts
            // But we can also cross-verify from the receipt metadata if it exists.
            
            await prisma.hms_product_batch.update({
                where: { id: entry.batch_id },
                data: {
                    cost: entry.unit_cost,
                    // If metadata exists, try to get MRP and Sale Price from there
                    mrp: (entry.metadata as any)?.mrp || undefined,
                    sale_price: (entry.metadata as any)?.salePrice || undefined
                }
            });

            // Also update the product master with the "latest" cost
            await prisma.hms_product.update({
                where: { id: entry.product_id },
                data: { default_cost: entry.unit_cost }
            });

            repairedCount++;
        }

        revalidatePath('/hms/inventory/reports/stock');
        return { success: true, message: `Successfully repaired costs for ${repairedCount} batches.` };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
