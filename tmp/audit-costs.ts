
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- BATCH COST AUDIT ---')
        
        const zeroCost = await prisma.hms_product_batch.findMany({
            where: {
                qty_on_hand: { gt: 0 },
                OR: [
                    { cost: { lte: 0 } },
                    { cost: null }
                ]
            },
            include: { hms_product: { select: { name: true } } },
            take: 20
        })
        
        console.log(`Found ${zeroCost.length} batches with stock but ZERO COST PRICE.`)
        zeroCost.forEach(b => {
             console.log(`- ${b.hms_product.name} | Batch: ${b.batch_no} | Cost: ${b.cost} | MRP: ${b.mrp}`)
        })
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
