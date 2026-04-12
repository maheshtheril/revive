
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- NUCLEAR INVENTORY WIPE (PHASE 2 - AGGRESSIVE) ---')
        
        // 1. Wipe everything that doesn't have a hard constraint
        console.log('Deleting Stock Ledger...')
        await (prisma as any).hms_product_stock_ledger.deleteMany({}).catch(() => {})
        
        console.log('Deleting Stock Levels...')
        await prisma.hms_stock_levels.deleteMany({}).catch(() => {})

        console.log('Deleting Batches...')
        await prisma.hms_product_batch.deleteMany({}).catch(() => {})

        // 2. Individual deletion of products to skip locked ones
        const products = await prisma.hms_product.findMany({ select: { id: true, name: true } })
        console.log(`Attempting to delete ${products.length} products one-by-one...`)
        
        let deleted = 0
        let locked = 0

        for (const p of products) {
            try {
                await prisma.hms_product.delete({ where: { id: p.id } })
                deleted++
            } catch (e) {
                locked++
            }
        }

        console.log(`SUMMARY:`)
        console.log(`- Deleted: ${deleted}`)
        console.log(`- Locked (Kept): ${locked}`)
        console.log('--- WIPE COMPLETE ---')
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
