
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- NUCLEAR FACTORY RESET (WIPING ALL TRANSACTIONS) ---')
        
        // --- 1. HMS CLINICAL & PATIENTS ---
        console.log('Wiping Clinical Records...')
        await prisma.hms_vitals.deleteMany({}).catch(() => {})
        await prisma.hms_medication_administration.deleteMany({}).catch(() => {})
        await prisma.hms_medication_order.deleteMany({}).catch(() => {})
        await prisma.hms_procedure.deleteMany({}).catch(() => {})
        await prisma.hms_progress_notes.deleteMany({}).catch(() => {})
        await prisma.prescription_items.deleteMany({}).catch(() => {})
        await (prisma as any).prescription.deleteMany({}).catch(() => {})
        await prisma.doctor_note.deleteMany({}).catch(() => {})
        
        console.log('Wiping Lab Records...')
        await prisma.hms_lab_result.deleteMany({}).catch(() => {})
        await prisma.hms_lab_order_lines.deleteMany({}).catch(() => {})
        await prisma.hms_lab_order_line.deleteMany({}).catch(() => {})
        await prisma.hms_lab_order.deleteMany({}).catch(() => {})
        await prisma.hms_lab_sample.deleteMany({}).catch(() => {})

        console.log('Wiping Patient History & Master...')
        await prisma.hms_patient_history.deleteMany({}).catch(() => {})
        await prisma.hms_patient_version.deleteMany({}).catch(() => {})
        await prisma.hms_patient_insights.deleteMany({}).catch(() => {})
        await prisma.hms_admission.deleteMany({}).catch(() => {})
        await prisma.hms_appointments.deleteMany({}).catch(() => {})
        await prisma.hms_encounter.deleteMany({}).catch(() => {})
        await prisma.hms_patient.deleteMany({}).catch(() => {})

        // --- 2. SALES & RETURNS ---
        console.log('Wiping Sales & Returns...')
        await prisma.hms_payment_allocations.deleteMany({}).catch(() => {})
        await prisma.hms_invoice_payments.deleteMany({}).catch(() => {})
        await prisma.hms_invoice_history.deleteMany({}).catch(() => {})
        await prisma.hms_sales_return_line.deleteMany({}).catch(() => {})
        await prisma.hms_sales_return.deleteMany({}).catch(() => {})
        await prisma.hms_invoice_lines.deleteMany({}).catch(() => {})
        await prisma.hms_invoice.deleteMany({}).catch(() => {})

        // --- 3. PURCHASING ---
        console.log('Wiping Purchasing...')
        await (prisma as any).hms_purchase_invoice_line.deleteMany({}).catch(() => {})
        await (prisma as any).hms_purchase_invoice.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_return_line.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_return.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_receipt_line.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_receipt.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_order_line.deleteMany({}).catch(() => {})
        await prisma.hms_purchase_order.deleteMany({}).catch(() => {})

        // --- 4. INVENTORY HISTORY (BATCHES) ---
        console.log('Wiping Inventory Batches & Ledger...')
        await (prisma as any).hms_product_stock_ledger.deleteMany({}).catch(() => {})
        await prisma.hms_stock_levels.deleteMany({}).catch(() => {})
        await prisma.hms_product_batch.deleteMany({}).catch(() => {})
        await prisma.hms_stock_adjustment_line.deleteMany({}).catch(() => {})
        await prisma.hms_stock_adjustment.deleteMany({}).catch(() => {})
        await prisma.hms_product_price_history.deleteMany({}).catch(() => {})

        // --- 5. ACCOUNTING ENTRIES ---
        console.log('Wiping Accounting Journal Entries...')
        await prisma.journal_entry_lines.deleteMany({}).catch(() => {})
        await prisma.journal_entries.deleteMany({}).catch(() => {})
        await (prisma as any).journal_lines.deleteMany({}).catch(() => {})

        // --- 6. FINAL PRODUCT MASTER CLEANUP ---
        console.log('Wiping Product Master (Aggressive)...')
        await prisma.hms_product_category_rel.deleteMany({}).catch(() => {})
        await prisma.hms_product.deleteMany({}).catch(() => {})

        console.log('--- FACTORY RESET COMPLETE ---')
        console.log('ALL TRANSACTIONS CLEARED.')
        console.log('Configuration (COA, UOMs, Categories, Branches, Users) Preserved.')
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
