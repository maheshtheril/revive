
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- FORCING TRUNCATE (RAW SQL) ---')
        
        // List of transactional tables to empty with CASCADE
        const tables = [
            'hms_invoice',
            'hms_patient',
            'hms_product',
            'hms_purchase_order',
            'hms_lab_order',
            'journal_entries',
            'hms_appointments',
            'hms_encounter',
            'hms_admission',
            'doctor_note',
            'hms_stock_adjustment',
            'hms_sales_return',
            'hms_purchase_return',
            'hms_purchase_receipt',
            'hms_purchase_invoice'
        ]

        for (const table of tables) {
            console.log(`Truncating ${table}...`)
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`).catch(e => {
                console.log(`Skip ${table}: ${e.message}`)
            })
        }

        console.log('--- FORCE COMPLETE ---')
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
