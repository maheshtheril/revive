
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- GLOBAL PRICING REPAIR (BULK PATCH) ---')
        
        // Find all batches with 0 pricing
        const batches = await prisma.hms_product_batch.findMany({
            where: {
                OR: [
                    { mrp: { lte: 0 } },
                    { mrp: null },
                    { cost: { lte: 0 } },
                    { cost: null },
                    { sale_price: { lte: 0 } },
                    { sale_price: null }
                ]
            },
            include: {
                hms_product: true
            }
        })

        console.log(`Found ${batches.length} batches needing pricing repair.`)
        
        let repairedCount = 0
        let skippedCount = 0

        for (const batch of batches) {
            const product = batch.hms_product
            const meta = (product.metadata as any) || {}
            
            // Derive prices from Master record (Product metadata or price field)
            const masterMrp = Number(meta.mrp || meta.last_mrp || 0)
            const masterCost = Number(meta.cost_price || meta.purchase_price || meta.purchase_cost || 0)
            const masterSale = Number(product.price || meta.last_sale_price || 0)

            // Current Batch Prices (fallback if already non-zero)
            const currentMrp = Number(batch.mrp || 0)
            const currentCost = Number(batch.cost || 0)
            const currentSale = Number(batch.sale_price || 0)

            // Final Assignment (Only patch if current is 0 and master has value)
            const targetMrp = currentMrp > 0 ? currentMrp : masterMrp
            const targetCost = currentCost > 0 ? currentCost : masterCost
            const targetSale = currentSale > 0 ? currentSale : masterSale

            if (targetMrp > 0 || targetCost > 0 || targetSale > 0) {
                await prisma.hms_product_batch.update({
                    where: { id: batch.id },
                    data: {
                        mrp: targetMrp,
                        cost: targetCost,
                        sale_price: targetSale
                    }
                })
                repairedCount++
            } else {
                skippedCount++
            }
        }

        console.log(`REPAIR COMPLETE: ${repairedCount} batches updated. ${skippedCount} items skipped (no master prices found).`)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
