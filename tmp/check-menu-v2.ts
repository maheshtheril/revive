
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const menuItems = await prisma.menu_items.findMany({
            where: {
                url: { contains: '/inventory/reports/stock' }
            }
        });
        
        console.log('--- MENU ITEMS FOR STOCK REPORT ---')
        console.table(menuItems)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
