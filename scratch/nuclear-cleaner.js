const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearTransactions() {
    console.log("--- NUCLEAR CLINICAL CLEANER ---");
    try {
        // We assume the user wants to clear EVERYTHING visit-related to start fresh
        
        console.log("Purging Invoices...");
        await prisma.$executeRaw`DELETE FROM hms_invoice_lines`;
        await prisma.$executeRaw`DELETE FROM hms_invoice_payments`;
        await prisma.$executeRaw`DELETE FROM hms_invoice_history`;
        await prisma.$executeRaw`DELETE FROM hms_invoice`;

        console.log("Purging Stock Moves & Ledger...");
        await prisma.$executeRaw`DELETE FROM hms_stock_move`;
        await prisma.$executeRaw`DELETE FROM hms_stock_ledger`;
        await prisma.$executeRaw`UPDATE hms_stock_levels SET quantity = 0`;

        console.log("Purging Prescriptions...");
        await prisma.$executeRaw`DELETE FROM prescription_items`;
        await prisma.$executeRaw`DELETE FROM prescription`;

        console.log("Purging Lab Orders...");
        await prisma.$executeRaw`DELETE FROM hms_lab_order_line`;
        await prisma.$executeRaw`DELETE FROM hms_lab_order_lines`;
        await prisma.$executeRaw`DELETE FROM hms_lab_order`;

        console.log("Purging Vitals...");
        await prisma.$executeRaw`DELETE FROM hms_vitals`;

        console.log("Resetting Appointments...");
        await prisma.$executeRaw`UPDATE hms_appointments SET status = 'scheduled'`;

        console.log("SUCCESS: Clinical Slate is Cleaned.");
    } catch (e) {
        console.error("FAILURE:", e);
    } finally {
        await prisma.$disconnect();
    }
}

clearTransactions();
