import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearTransactionalData() {
  console.log('🚀 Starting surgical data cleanup...')

  try {
    // 1. CLEAR FINANCIAL DATA (Dependent tables first)
    console.log('Cleaning Financials...')
    await prisma.$executeRaw`DELETE FROM hms_payment_allocations CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_payment_transaction CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_invoice_item CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_invoice CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_accounting_voucher_item CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_accounting_voucher CASCADE`

    // 2. CLEAR PURCHASING & INVENTORY
    console.log('Cleaning Inventory & Purchasing...')
    await prisma.$executeRaw`DELETE FROM hms_stock_ledger_entry CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_purchase_bill_item CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_purchase_bill CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_purchase_order_item CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_purchase_order CASCADE`

    // 3. CLEAR CLINICAL DATA
    console.log('Cleaning Clinical Records...')
    await prisma.$executeRaw`DELETE FROM hms_lab_result CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_lab_order_line CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_lab_order_lines CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_lab_order CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_medication_administration CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_medication_order CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_prescription_items CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_prescription CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_vital_reading CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_vital_sign CASCADE`
    
    // 4. CLEAR PATIENTS & APPOINTMENTS (The core "OP Registrations")
    console.log('Cleaning Patient Registry...')
    await prisma.$executeRaw`DELETE FROM hms_appointments CASCADE`
    await prisma.$executeRaw`DELETE FROM hms_patient CASCADE`

    console.log('✅ Transactional data cleared. Configuration preserved.')
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearTransactionalData()
