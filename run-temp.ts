import { prisma } from './src/lib/prisma';
import { getMenuItems } from './src/app/actions/temp-nav';

async function main() {
    console.log("Fetching menu items for Receptionist...");
    const items = await getMenuItems();
    console.log(JSON.stringify(items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
