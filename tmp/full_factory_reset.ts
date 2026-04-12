import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runReset() {
    console.log("\n🚀 [CORE-MAINTENANCE] INITIALIZING HMS DATA PURGE...");

    try {
        // --- PHASE 1: TRANSACTIONAL LINE ITEMS ---
        console.log("🧹 Clearing Transaction Lines...");
        await prisma.hms_invoice_lines.deleteMany({});
        await prisma.hms_purchase_order_line.deleteMany({});
        await prisma.hms_purchase_receipt_line.deleteMany({});
        await prisma.hms_purchase_invoice_line.deleteMany({});
        await prisma.hms_lab_order_lines.deleteMany({});
        await prisma.hms_lab_order_line.deleteMany({});
        await prisma.hms_payment_allocations.deleteMany({});
        await prisma.hms_sales_return_line.deleteMany({});
        await prisma.hms_purchase_return_line.deleteMany({});
        await prisma.hms_stock_adjustment_line.deleteMany({});

        // --- PHASE 2: FINANCIAL & INVENTORY HEADERS ---
        console.log("🧹 Clearing Financials & Stock Records...");
        await prisma.hms_invoice_payments.deleteMany({});
        await prisma.hms_invoice.deleteMany({});
        await prisma.hms_purchase_invoice.deleteMany({});
        await prisma.hms_purchase_receipt.deleteMany({});
        await prisma.hms_purchase_order.deleteMany({});
        await prisma.hms_sales_return.deleteMany({});
        await prisma.hms_purchase_return.deleteMany({});
        await prisma.hms_stock_adjustment.deleteMany({});
        await prisma.hms_stock_ledger.deleteMany({});
        await prisma.hms_stock_levels.deleteMany({});
        await prisma.hms_stock_move.deleteMany({});
        await prisma.hms_stock_reservation.deleteMany({});
        await prisma.hms_stock_valuation.deleteMany({});
        await prisma.journal_entry_lines.deleteMany({});
        await prisma.journal_entries.deleteMany({});

        // --- PHASE 3: CLINICAL & PATIENT FLOW ---
        console.log("🧹 Clearing Patients & Clinical Encounters...");
        await prisma.hms_vitals.deleteMany({});
        await prisma.hms_triage.deleteMany({});
        await prisma.hms_lab_order.deleteMany({});
        await prisma.hms_admission.deleteMany({});
        await prisma.hms_encounter.deleteMany({});
        await prisma.hms_appointments.deleteMany({});
        await prisma.prescription.deleteMany({});
        await prisma.doctor_note.deleteMany({});
        await prisma.hms_patient.deleteMany({}); 

        // --- PHASE 4: NON-SERVICE ITEM MASTER ---
        console.log("🧹 Purging Non-Service (Physical) Item Catalog...");
        // This clears all Medicines, Consumables, and Assets
        // But KEEPS Consultation Fees, Registration Fees, and Lab Test definitions
        await prisma.hms_product.deleteMany({
            where: {
                OR: [
                    { is_service: false },
                    { is_stockable: true }
                ]
            }
        });

        console.log("\n✨ HMS DATA PURGE COMPLETE.");
        console.log("--------------------------------------------------");
        console.log("❌ DELETED: Sales, Purchases, Payments, Stock, Vitals, and Patient Records.");
        console.log("🛡️  PRESERVED: System Users, Branch Setup, Doctor Profiles, and Service Configs.");
        console.log("--------------------------------------------------\n");

    } catch (error) {
        console.error("\n❌ [CRITICAL-ERROR] DATA PURGE ABORTED:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runReset();
