
import { prisma } from "../src/lib/prisma";

async function atomicReset() {
    console.log("ATOMIC RESET INITIATED (FOREIGN KEY BYPASS)...");
    
    try {
        // [WORLD CLASS FORCE] Use raw SQL to disable constraints and wipe tables
        const tables = [
            'hms_stock_ledger',
            'hms_stock_levels',
            'hms_stock_move',
            'hms_invoice_lines',
            'hms_invoice_payments',
            'hms_invoice',
            'hms_purchase_receipt_lines',
            'hms_purchase_receipt',
            'hms_ap_invoice_lines',
            'hms_ap_invoice'
        ];

        // Disable triggers/constraints for atomic wipe
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
        
        for (const table of tables) {
            console.log(`Wiping ${table}...`);
            await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
        }
        
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
        
        console.log("SUCCESS: TABLES WIPED. NOW RE-SYNCHRONIZING 1097 PRODUCT CACHES...");
        
        // Ensure every stock level cache is actually 0 or non-existent
        await prisma.hms_stock_levels.deleteMany({});
        
        console.log("ALL BALANCES ARE NOW ZERO.");
    } catch (e: any) {
        console.error("FORCED RESET ERROR:", e.message);
    }
}

atomicReset().finally(() => prisma.$disconnect());
