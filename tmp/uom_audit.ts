import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.hms_product.findFirst({
        where: { name: { contains: 'ON CALL PLUS STRIPS', mode: 'insensitive' } },
        include: {
            hms_product_batch: {
                orderBy: { created_at: 'desc' },
                take: 5
            },
            hms_stock_ledger: {
                orderBy: { created_at: 'desc' },
                take: 10
            }
        }
    });

    if (!p) {
        console.log('Product NO_MATCH_ON_NAME');
        process.exit(0);
    }

    console.log('PRODUCT_NAME:', p.name);
    console.log('BASE_UOM:', p.uom);
    console.log('METADATA:', JSON.stringify(p.metadata, null, 2));
    console.log('LATEST_BATCH:', JSON.stringify(p.hms_product_batch[0], null, 2));
    console.log('LATEST_LEDGER:', JSON.stringify(p.hms_stock_ledger[0], null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
