
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- RECOVERING ORPHANED OPENING STOCK ---')
        
        const orphans = await (prisma as any).hms_product_stock_ledger.findMany({
            where: {
                movement_type: 'OPENING',
                batch_id: null,
                change_qty: { gt: 0 }
            }
        });
        
        console.log(`Found ${orphans.length} orphaned opening stock entries with no batch.`)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
