
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- SERVICE PRICE OVERRIDE AUDIT ---')
        
        const services = ['CONS-SPEC', 'CXR-SCAN', 'CONS-GEN', 'CBC-TEST']
        
        for (const sku of services) {
            const p = await prisma.hms_product.findFirst({
                where: { sku },
                include: {
                    hms_product_price_history: {
                        orderBy: { valid_from: 'desc' },
                        take: 1
                    }
                }
            })
            
            if (p) {
                const historyPrice = p.hms_product_price_history[0]?.price || 'N/A'
                console.log(`Service: ${p.name.padEnd(30)} | SKU: ${p.sku.padEnd(10)} | Master Price: ${p.price} | History Override: ${historyPrice}`)
            }
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
