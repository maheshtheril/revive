
import { prisma } from "../src/lib/prisma";

async function trueMasterTruncate() {
    console.log("TRUE MASTER TRUNCATE (CASCADE)...");
    
    try {
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

        // [WORLD CLASS TRUNCATE] Disable all constraints and wipe clean
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
        
        for (const table of tables) {
            try {
                console.log(`Truncating ${table}...`);
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
            } catch (e: any) {
                console.log(`Table ${table} skip: ${e.message}`);
            }
        }
        
        await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
        
        // RE-AUDIT TO BE 100% SURE
        const counts = await Promise.all([
            prisma.hms_stock_ledger.count(),
            prisma.hms_stock_levels.count(),
            prisma.hms_invoice.count()
        ]);
        
        console.log(`FINAL AUDIT - Ledger: ${counts[0]}, Levels: ${counts[1]}, Invoices: ${counts[2]}`);
        
        if (counts[0] === 0 && counts[1] === 0) {
            console.log("MASTER CLEANSE SUCCESSFUL.");
        } else {
            console.log("CLEANSE INCOMPLETE. TRYING BACKUP WIPE...");
            await prisma.hms_stock_levels.deleteMany({});
            await prisma.hms_stock_ledger.deleteMany({});
        }

    } catch (e: any) {
        console.error("CRITICAL TRUNCATE ERROR:", e.message);
    }
}

trueMasterTruncate().finally(() => prisma.$disconnect());
