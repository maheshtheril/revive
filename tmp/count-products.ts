
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const count = await prisma.hms_product.count()
        console.log('TOTAL_PRODUCTS_COUNT:', count)
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
