import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const products = await prisma.hms_product.findMany({
        where: { name: { contains: 'ON CALL PLUS STRIPS', mode: 'insensitive' } },
        include: {
            hms_stock_levels: true,
            hms_stock_ledger: { orderBy: { created_at: 'desc' }, take: 20 },
            hms_product_batch: true
        }
    })

    console.log(JSON.stringify(products, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
