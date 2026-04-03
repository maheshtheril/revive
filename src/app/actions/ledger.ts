'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

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

        return { success: true, data: entries };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
