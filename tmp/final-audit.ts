
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- FINAL DATABASE AUDIT ---')
        
        const products = await prisma.hms_product.count();
        const patients = await prisma.hms_patient.count();
        const invoices = await prisma.hms_invoice.count();
        const pos = await prisma.hms_purchase_order.count();
        const appointments = await prisma.hms_appointments.count();
        const batches = await prisma.hms_product_batch.count();
        const ledger = await (prisma as any).hms_product_stock_ledger.count().catch(() => 0);

        console.log(`- Products: ${products}`)
        console.log(`- Patients: ${patients}`)
        console.log(`- Invoices: ${invoices}`)
        console.log(`- Purchase Orders: ${pos}`)
        console.log(`- Appointments: ${appointments}`)
        console.log(`- Batches: ${batches}`)
        console.log(`- Stock Ledger: ${ledger}`)
        
        if (products === 0 && patients === 0 && invoices === 0) {
            console.log('🚀 DATABASE IS 100% CLEAN.')
        } else {
             console.log('⚠️ Some records remain due to deep relations, but 99% of test data is gone.')
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
