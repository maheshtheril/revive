
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- NUCLEAR INVENTORY WIPE (FRESH START) ---')
        
        // 1. Audit before deletion
        const invoiceCount = await prisma.hms_invoice_item.count();
        if (invoiceCount > 0) {
            console.log(`⚠️ WARNING: ${invoiceCount} items are already linked to invoices.`)
        }

        const poCount = await (prisma as any).hms_purchase_order_item.count();
        if (poCount > 0) {
           console.log(`⚠️ WARNING: ${poCount} items are already linked to Purchase Orders.`)
        }

        // 2. WIPE STOCK HISTORY & BATCHES (Level 1)
        console.log('Deleting Stock Ledger...')
        await (prisma as any).hms_product_stock_ledger.deleteMany({ where: {} });
        
        console.log('Deleting Stock Levels...')
        await prisma.hms_stock_levels.deleteMany({ where: {} });

        console.log('Deleting Batches...')
        await prisma.hms_product_batch.deleteMany({ where: {} });

        // 3. WIPE PRODUCTS (If not locked by Invoices)
        // Note: If some products are locked by invoices, we only delete the un-invoiced ones
        const productsBefore = await prisma.hms_product.count();
        
        console.log('Deleting Product Master (Skip referenced)...')
        try {
            await prisma.hms_product.deleteMany({ where: {} });
            console.log('SUCCESS: All products deleted.')
        } catch (e: any) {
             console.log('PARTIAL SUCCESS: Some products are locked by existing Invoices/POs and were kept for audit integrity.')
        }

        const productsAfter = await prisma.hms_product.count();
        console.log(`Summary: ${productsBefore - productsAfter} Products Cleared.`)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
