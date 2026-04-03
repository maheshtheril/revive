
import { prisma } from "../src/lib/prisma";

async function finalAtomicWipe() {
    console.log("EXECUTE ABSOLUTE FINAL WIPE...");
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

    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
    for (const t of tables) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
        } catch(e) {}
    }
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
    console.log("DATABASE ZEROED.");
}

finalAtomicWipe().finally(() => prisma.$disconnect());
