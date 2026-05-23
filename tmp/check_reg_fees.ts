import { prisma } from '../src/lib/prisma';

async function main() {
    const rogues = await prisma.hms_product.findMany({
        where: { name: { contains: 'Registration', mode: 'insensitive' }, is_service: false }
    });
    
    for (const p of rogues) {
        await prisma.hms_product.update({
            where: { id: p.id },
            data: { is_active: false, name: `${p.name} (DEPRECATED)`, sku: `${p.sku}-DEL` }
        });
        console.log(`Deactivated rogue item: ${p.name} (${p.sku})`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
