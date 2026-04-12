
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- STOCK WITHOUT BATCH AUDIT ---')
        
        const orphans = await (prisma as any).$queryRaw`
            SELECT 
                p.sku, 
                p.name, 
                sl.quantity,
                sl.batch_id
            FROM hms_stock_levels sl
            JOIN hms_product p ON sl.product_id = p.id
            WHERE sl.batch_id IS NULL AND sl.quantity > 0;
        `;
        
        console.log(`Found ${orphans.length} stock levels with positive quantity but NO BATCH ID linking.`)
        if (orphans.length > 0) {
            console.log('Sample (Top 10):')
            console.table(orphans.slice(0, 10))
        }
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
