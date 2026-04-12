
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        console.log('--- REPLICATING STOCK REPORT LOGIC AUDIT ---')
        
        const companyId = '75d713c7-3b2d-48bd-b710-9118c7c10b25' // From previous logs/sessions if any or I will find it
        // Wait, I should find a valid companyId
        const company = await prisma.company.findFirst()
        if (!company) return
        const cid = company.id
        const tid = company.tenant_id

        const reportData = []
        const products = await prisma.hms_product.findMany({
            where: { tenant_id: tid, is_active: true },
            include: {
                hms_product_batch: {
                    where: { company_id: cid, qty_on_hand: { gt: 0 } }
                }
            },
            take: 100
        })

        products.forEach(p => {
             const batches = p.hms_product_batch
             if (batches.length === 0) {
                 reportData.push({ name: p.name, sku: p.sku, qty: 0, cost: p.default_cost?.toNumber() || 0, mrp: (p.metadata as any)?.last_mrp || 0 })
             } else {
                 batches.forEach(b => {
                     reportData.push({ name: p.name, sku: p.sku, qty: b.qty_on_hand.toNumber(), cost: b.cost.toNumber(), mrp: b.mrp.toNumber() })
                 })
             }
        })

        const zeroPriced = reportData.filter(r => r.mrp === 0 && r.qty > 0)
        console.log(`Found ${zeroPriced.length} items WITH STOCK but ZERO MRP in the Report Generator logic.`)
        
        if (zeroPriced.length > 0) {
            console.log('Sample Zero Price (With Stock):')
            console.table(zeroPriced.slice(0, 10))
        } else {
            const allZero = reportData.filter(r => r.mrp === 0)
            console.log(`Found ${allZero.length} items in total with 0 MRP in Report (most likely 0 stock).`)
            console.log('Sample (Top 20):')
             console.table(allZero.slice(0, 20))
        }
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
