
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- DETAILED STOCK-PRICE INTEGRITY CHECK (RAW SQL) ---')
        
        // This query finds items that HAVE stock in hms_stock_levels 
        // but have zero/missing pricing in both the Batch and the Product Master.
        const result = await (prisma as any).$queryRaw`
            SELECT 
                p.sku, 
                p.name, 
                sl.quantity as stock_qty,
                b.batch_no,
                b.mrp,
                b.sale_price,
                p.price as master_price
            FROM hms_stock_levels sl
            JOIN hms_product p ON sl.product_id = p.id
            LEFT JOIN hms_product_batch b ON sl.batch_id = b.id
            WHERE 
                (b.mrp IS NULL OR b.mrp = 0) 
                AND (p.price IS NULL OR p.price = 0)
                AND sl.quantity > 0
            LIMIT 50;
        `;
        
        if (result.length === 0) {
            console.log("No items found with stock and 0 price across both Batch and Master.");
        } else {
            console.log(`Found ${result.length} items with Stock but NO price (Batch or Master):\n`);
            console.table(result);
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
