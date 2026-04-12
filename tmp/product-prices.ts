
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const batches = await prisma.hms_product_batch.findMany({
            take: 30,
            include: {
                hms_product: {
                    select: { name: true, sku: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })
        
        console.log('--- PHARMACY PRICE AUDIT (BATCH-LEVEL) ---')
        console.log(''.padEnd(100, '-'))
        console.log(`${"Product Name".padEnd(40)} | ${"Batch".padEnd(15)} | ${"Cost".padStart(10)} | ${"Sale".padStart(10)} | ${"MRP".padStart(10)}`)
        console.log(''.padEnd(100, '-'))
        
        batches.forEach(b => {
            const name = b.hms_product.name
            const batchNo = b.batch_no || 'N/A'
            const cost = b.cost ? b.cost.toFixed(2) : '0.00'
            const sale = b.sale_price ? b.sale_price.toFixed(2) : '0.00'
            const mrp = b.mrp ? b.mrp.toFixed(2) : '0.00'
            
            console.log(`${name.substring(0, 39).padEnd(40)} | ${batchNo.padEnd(15)} | ${cost.padStart(10)} | ${sale.padStart(10)} | ${mrp.padStart(10)}`)
        })
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
