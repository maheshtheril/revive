import { prisma } from '../src/lib/prisma';

async function main() {
    const products = await prisma.hms_product.findMany({
        where: {
            is_active: true,
            OR: [
                { name: { contains: 'Reg', mode: 'insensitive' } },
                { name: { contains: 'Fee', mode: 'insensitive' } },
                { sku: { contains: 'REG', mode: 'insensitive' } }
            ]
        }
    });
    
    console.log(products.map(p => ({ id: p.id, name: p.name, sku: p.sku, price: Number(p.price), is_service: p.is_service, is_stockable: p.is_stockable })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
