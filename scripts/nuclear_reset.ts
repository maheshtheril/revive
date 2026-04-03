
import { prisma } from "../src/lib/prisma";

async function nuclearReset() {
    try {
        console.log("NUCLEAR RESET INITIATED - TRUNCATING TRANSACTION TABLES...");
        
        // Disable constraints for deletion if needed (Prisma handles some cascade)
        await prisma.hms_stock_ledger.deleteMany({});
        await prisma.hms_stock_levels.deleteMany({});
        await prisma.hms_stock_move.deleteMany({});
        
        await prisma.hms_invoice_lines.deleteMany({});
        await prisma.hms_invoice.deleteMany({});
        
        await prisma.hms_purchase_receipt_lines.deleteMany({});
        await prisma.hms_purchase_receipt.deleteMany({});
        
        await prisma.hms_ap_invoice_lines.deleteMany({});
        await prisma.hms_ap_invoice.deleteMany({});
        
        console.log("SUCCESS: ALL PURCHASES AND SALES DELETED. SYSTEM IS AT ZERO.");
    } catch (e: any) {
        console.error("RESET ERROR:", e.message);
    }
}

nuclearReset().finally(() => prisma.$disconnect());
