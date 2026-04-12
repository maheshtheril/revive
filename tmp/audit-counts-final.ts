
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const productCount = await prisma.hms_product.count()
        const levelCount = await prisma.hms_stock_levels.count({ where: { quantity: { gt: 0 } } })
        const batchCount = await prisma.hms_product_batch.count()
        const batchWithStock = await prisma.hms_product_batch.count({ where: { qty_on_hand: { gt: 0 } } })
        
        console.log(`TOTAL PRODUCTS: ${productCount}`)
        console.log(`TOTAL BATCHES: ${batchCount}`)
        console.log(`BATCHES WITH STOCK: ${batchWithStock}`)
        console.log(`STOCK LEVEL RECORDS (Qty > 0): ${levelCount}`)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
