
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const mods = await prisma.modules.findMany();
    console.log("MODULES:", mods.map(m => m.module_key));
    
    // IF hms is missing or inactive, fix it
    const hms = mods.find(m => m.module_key === 'hms');
    if (!hms) {
        await prisma.modules.create({ data: { module_key: 'hms', name: 'Hospital', is_active: true } });
        console.log("CREATED HMS MODULE");
    } else if (!hms.is_active) {
        await prisma.modules.update({ where: { id: hms.id }, data: { is_active: true } });
        console.log("ACTIVATED HMS MODULE");
    }

    process.exit(0);
}
main();
