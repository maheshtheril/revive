
import { ensureAccountingMenu, ensureAdminMenus, ensureCrmMenus, ensureHmsMenus, ensurePurchasingMenus } from "../src/lib/menu-seeder";
import { prisma } from "../src/lib/prisma";

async function main() {
    console.log("Starting full menu seeding...");
    
    try {
        console.log("Seeding Admin Menus...");
        await ensureAdminMenus();
        
        console.log("Seeding Accounting/Finance Menus...");
        await ensureAccountingMenu();
        
        console.log("Seeding CRM Menus...");
        await ensureCrmMenus();
        
        console.log("Seeding HMS (Hospital) Menus...");
        await ensureHmsMenus();
        
        console.log("Seeding Purchasing (Inventory) Menus...");
        await ensurePurchasingMenus();
        
        console.log("Seeding complete!");
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
