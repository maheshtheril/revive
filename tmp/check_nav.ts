
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const menus = await prisma.menu_items.findMany({
        where: { key: { in: ['hms-lab', 'lab-pending', 'lab-orders'] } }
    });
    console.log("LAB MENUS IN DB:", menus.map(m => ({ key: m.key, label: m.label, module: m.module_key, url: m.url })));

    const hmsModule = await prisma.modules.findFirst({ where: { module_key: 'hms' } });
    console.log("HMS MODULE ACTIVE:", hmsModule?.is_active);

    const tenantModules = await prisma.tenant_module.findMany();
    console.log("TENANT MODULES ENABLED:", tenantModules.map(tm => ({ tenant: tm.tenant_id, module: tm.module_key, enabled: tm.enabled })));

    process.exit(0);
}
main();
