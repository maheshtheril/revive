
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- PRICE ZERO-VALUE AUDIT ---')
        
        // 1. Check Product Master for zero default price
        const zeroMaster = await prisma.hms_product.findMany({
            where: {
                is_active: true,
                price: { lte: 0 }
            },
            select: { id: true, name: true, sku: true, price: true }
        })
        
        console.log(`\nFound ${zeroMaster.length} active products in Master with 0 or missing price.`)
        if (zeroMaster.length > 0) {
            console.log('Sample Master Gaps (Top 10):')
            zeroMaster.slice(0, 10).forEach(p => {
                console.log(`- ${p.sku} | ${p.name} (Price: ${p.price})`)
            })
        }
        
        // 2. Check Batches for zero MRP or Sale Price
        const zeroBatches = await prisma.hms_product_batch.findMany({
            where: {
                OR: [
                    { mrp: { lte: 0 } },
                    { sale_price: { lte: 0 } }
                ]
            },
            include: {
                hms_product: { select: { name: true } }
            }
        })
        
        console.log(`\nFound ${zeroBatches.length} batches with 0 MRP or Sale Price.`)
        if (zeroBatches.length > 0) {
            console.log('Sample Batch Gaps (Top 10):')
            zeroBatches.slice(0, 10).forEach(b => {
                console.log(`- ${b.hms_product.name} | Batch: ${b.batch_no} (MRP: ${b.mrp}, Sale: ${b.sale_price})`)
            })
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
