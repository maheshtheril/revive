
import { prisma } from "../src/lib/prisma";

async function paperworkWipe() {
    console.log("FINAL PAPERWORK WIPE...");
    const tables = [
        'hms_purchase_invoice_line',
        'hms_purchase_invoice',
        'hms_purchase_order_line',
        'hms_purchase_order',
        'hms_purchase_receipt_line',
        'hms_purchase_receipt',
        'hms_purchase_return_line',
        'hms_purchase_return'
    ];

    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
    for (const t of tables) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
            console.log(`Wiped: ${t}`);
        } catch(e) {
            console.log(`Skip: ${t}`);
        }
    }
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
    
    // VERIFY
    const check = await prisma.hms_purchase_receipt.count();
    console.log(`FINAL RECEIPT COUNT: ${check}`);
}

paperworkWipe().finally(() => prisma.$disconnect());
