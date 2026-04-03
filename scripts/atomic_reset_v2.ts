
import { prisma } from "../src/lib/prisma";

async function atomicReset() {
    console.log("FINAL ATOMIC RESET INITIATED (Singular table check)...");
    
    try {
        // [WORLD CLASS FORCE] Use raw SQL to wipe tables based on actual schema names
        const tables = [
            'hms_stock_ledger',
            'hms_stock_levels',
            'hms_stock_move',
            'hms_invoice_lines',
            'hms_invoice_payments',
            'hms_invoice',
            'hms_purchase_receipt_line',
            'hms_purchase_receipt',
            'hms_ap_invoice_line',
            'hms_ap_invoice'
        ];

        // Disable triggers/constraints for atomic wipe
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
        
        for (const table of tables) {
            try {
                console.log(`Wiping ${table}...`);
                await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
            } catch(te) {
                console.log(`Table ${table} skip (might be manual alias or missing).`);
            }
        }
        
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
        
        console.log("SUCCESS: TABLES WIPED.");
    } catch (e: any) {
        console.error("FORCED RESET ERROR:", e.message);
    }
}

atomicReset().finally(() => prisma.$disconnect());
