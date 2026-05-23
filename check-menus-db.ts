import { prisma } from './src/lib/prisma';

async function main() {
    const menus = await prisma.menu_items.findMany({
        where: { permission_code: null },
        select: { label: true, url: true, permission_code: true }
    });
    console.log(`Found ${menus.length} menus with NULL permission_code`);
    if (menus.length > 0) {
        console.log("First 10 missing:", menus.slice(0, 10));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
