
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- SERVICE PRICE GAPS AUDIT ---')
        
        // 1. Check Services with 0 master price
        const zeroServices = await prisma.hms_product.findMany({
            where: {
                is_active: true,
                is_service: true,
                price: { lte: 0 }
            },
            select: { id: true, name: true, sku: true, price: true }
        })
        
        console.log(`\nFound ${zeroServices.length} active SERVICES with 0 price in Master.`)
        if (zeroServices.length > 0) {
            console.log('Sample Service Gaps (Top 10):')
            zeroServices.slice(0, 10).forEach(p => {
                console.log(`- ${p.sku} | ${p.name} (Price: ${p.price})`)
            })
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
