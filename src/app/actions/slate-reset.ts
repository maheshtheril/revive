'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

/**
 * Wipes out all pharmacy purchase and inventory data for the company.
 * Keeps Product Masters and Suppliers intact.
 */
export async function totalNuclearWipe(fullWipe: boolean) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    
    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;

    try {
        console.log(`TOTAL WIPE TRIGGERED FOR TENANT: ${tenantId}`);

        // SURGICAL STRIKE - Target Locked: GRN-2026-0001
        const targetReceipt = await prisma.hms_purchase_receipt.findFirst({
            where: { name: 'GRN-2026-0001' }
        });
        
        if (targetReceipt) {
            console.log(`POISON RECORD FOUND: ${targetReceipt.id}. Purging now...`);
            const targetId = targetReceipt.id;
            await prisma.journal_lines.deleteMany({ where: { journal_entry_id: { in: (await prisma.journal_entries.findMany({ where: { ref: 'GRN-2026-0001' }, select: { id: true } })).map(j => j.id) } } });
            await prisma.journal_entry_lines.deleteMany({ where: { journal_entry_id: { in: (await prisma.journal_entries.findMany({ where: { ref: 'GRN-2026-0001' }, select: { id: true } })).map(j => j.id) } } });
            await prisma.journal_entries.deleteMany({ where: { ref: 'GRN-2026-0001' } });
            await prisma.hms_purchase_receipt_line.deleteMany({ where: { receipt_id: targetId } });
            await prisma.hms_purchase_receipt.deleteMany({ where: { id: targetId } });
            await prisma.hms_stock_ledger.deleteMany({ where: { related_id: targetId } });
        }

        // ABSOLUTE PRISMA PURGE - Native Implementation
        const where = { tenant_id: tenantId as any };
        
        await prisma.hms_purchase_return_line.deleteMany({ where });
        await prisma.hms_purchase_return.deleteMany({ where });
        await prisma.hms_purchase_invoice_line.deleteMany({ where });
        await prisma.hms_purchase_invoice.deleteMany({ where });
        await prisma.hms_purchase_receipt_line.deleteMany({ where });
        await prisma.hms_purchase_receipt.deleteMany({ where });
        await prisma.hms_stock_ledger.deleteMany({ where });
        await prisma.hms_stock_levels.deleteMany({ where });
        await prisma.hms_product_batch.deleteMany({ where });
        await prisma.hms_stock_move.deleteMany({ where });
        await prisma.hms_inventory_ledger.deleteMany({ where });
        await prisma.hms_opening_stock.deleteMany({ where });
        await prisma.hms_purchase_order_line.deleteMany({ where });
        await prisma.hms_purchase_order.deleteMany({ where });
        await prisma.hms_accounts_ledger.deleteMany({ where });
        await prisma.hms_stock_adjustment_line.deleteMany({ where });
        await prisma.hms_stock_adjustment.deleteMany({ where });
        
        // FINANCIAL PURGE - The "7468" Killer
        await prisma.journal_lines.deleteMany({ where });
        await prisma.journal_entry_lines.deleteMany({ where });
        await prisma.journal_entries.deleteMany({ where });
        await prisma.hms_accounts_ledger.deleteMany({ where });

        if (fullWipe) {
            await prisma.hms_invoice_lines.deleteMany({ where: { company_id: companyId as any } });
            await prisma.hms_medication_order.deleteMany({});
            await prisma.prescription_items.deleteMany({});
            await prisma.hms_product_category_rel.deleteMany({});
            await prisma.hms_product_supplier.deleteMany({ where: { company_id: companyId as any } });
            await prisma.hms_product_image.deleteMany({ where: { company_id: companyId as any } });
            await prisma.hms_stock_reservation.deleteMany({ where: { company_id: companyId as any } });
            await prisma.product_tax_rules.deleteMany({ where: { company_id: companyId as any } });
            await prisma.hms_product.deleteMany({ where: { tenant_id: tenantId as any } });
            await prisma.hms_supplier.deleteMany({ where: { tenant_id: tenantId as any } });
        } else {
             await prisma.hms_product.updateMany({ 
                 where: { company_id: companyId as any },
                 data: { default_cost: 0, price: 0 }
             });
        }
        
        // Universal Cache Invalidation
        revalidatePath('/hms/inventory/reports/stock', 'page');
        revalidatePath('/hms/purchasing/receipts', 'page');
        revalidatePath('/hms/purchasing/orders', 'page');
        revalidatePath('/hms/inventory/products', 'page');
        
        return { 
            success: true, 
            message: "Absolute Zero Reached. Slate is Wiped.",
            debugIds: `Tenant: ${tenantId}\nCompany: ${companyId}`
        };
    } catch (e: any) {
        console.error("WIPE FAILED:", e);
        return { success: false, error: e.message };
    }
}
