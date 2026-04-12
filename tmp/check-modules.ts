
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const modules = await prisma.modules.findMany({
            where: {
                name: { contains: 'Inventory', mode: 'insensitive' }
            }
        });
        
        console.log('--- INVENTORY MODULES ---')
        console.table(modules)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
