import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Simple prisma init to avoid complex imports
const connectionURL = process.env.DATABASE_URL || "postgresql://postgres:hms2035@localhost:5432/hms_db";
const prisma = new PrismaClient({ datasourceUrl: connectionURL });

import { 
    ensureAccountingMenu, 
    ensureAdminMenus, 
    ensureCrmMenus, 
    ensureHmsMenus, 
    ensurePurchasingMenus 
} from "../lib/menu-seeder";

async function main() {
    console.log("🚀 Starting Menu & Module Synchronization...");

    try {
        // 1. Ensure core modules exist and are active
        const modules = [
            { key: 'hms', name: 'Hospital' },
            { key: 'finance', name: 'Gateway of Tally' },
            { key: 'inventory', name: 'Inventory & Procurement' },
            { key: 'crm', name: 'CRM & HR' },
            { key: 'configuration', name: 'Settings' }
        ];

        for (const mod of modules) {
            await prisma.modules.upsert({
                where: { module_key: mod.key },
                update: { is_active: true, name: mod.name },
                create: { module_key: mod.key, name: mod.name, is_active: true }
            });
            console.log(`✅ Module synced: ${mod.name}`);
        }

        // 2. Run all seeders
        console.log("📦 Seeding menus...");
        await ensureHmsMenus();
        await ensureAccountingMenu();
        await ensurePurchasingMenus();
        await ensureCrmMenus();
        await ensureAdminMenus();

        console.log("🏁 Sync Complete!");
    } catch (error) {
        console.error("❌ Sync Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
