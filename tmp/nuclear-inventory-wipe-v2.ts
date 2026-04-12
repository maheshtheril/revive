
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- NUCLEAR INVENTORY WIPE (FRESH START) ---')
        
        // 1. Audit before deletion
        const invoiceLineCount = await prisma.hms_invoice_lines.count();
        if (invoiceLineCount > 0) {
            console.log(`⚠️ WARNING: ${invoiceLineCount} items are already linked to invoices. These products will NOT be deleted to preserve audit history.`)
        }

        // 2. WIPE STOCK HISTORY & BATCHES (Level 1)
        console.log('Deleting Stock Ledger...')
        await (prisma as any).hms_product_stock_ledger.deleteMany({ where: {} });
        
        console.log('Deleting Stock Levels...')
        await prisma.hms_stock_levels.deleteMany({ where: {} });

        console.log('Deleting Batches...')
        await prisma.hms_product_batch.deleteMany({ where: {} });

        // 3. WIPE PRODUCTS
        // We find all product IDs that ARE in invoices to exclude them
        const invoicedProductIds = await prisma.hms_invoice_lines.findMany({
            select: { product_id: true },
            where: { product_id: { not: null } }
        }).then(items => items.map(i => i.product_id as string));

        const productsBefore = await prisma.hms_product.count();
        
        console.log('Deleting Product Master (Skip referenced)...')
        
        const deleteResult = await prisma.hms_product.deleteMany({
            where: {
                id: { notIn: invoicedProductIds }
            }
        });

        console.log(`SUCCESS: ${deleteResult.count} products deleted.`)

        const productsAfter = await prisma.hms_product.count();
        if (productsAfter > 0) {
            console.log(`Note: ${productsAfter} products were kept because they have existing invoice history.`)
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
