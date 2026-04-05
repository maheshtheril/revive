import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const product = await prisma.hms_product.findFirst({
        where: { name: { contains: 'ON CALL PLUS STRIPS', mode: 'insensitive' } }
    })

    if (!product) {
        console.log("Product not found")
        return
    }

    // Find the last inward ledger entry
    const lastInward = await prisma.hms_stock_ledger.findFirst({
        where: { product_id: product.id, movement_type: 'in' },
        orderBy: { created_at: 'desc' }
    })

    if (lastInward) {
        console.log("Last Inward Entry:", lastInward)
        
        // If qty was 5 and it should have been 250 (5 * 50)
        // We need to add 245 units.
        const adjustment = 245;

        await prisma.$transaction([
            // 1. Update stock levels
            prisma.hms_stock_levels.updateMany({
                where: { product_id: product.id, batch_id: lastInward.batch_id },
                data: { quantity: { increment: adjustment } }
            }),
            // 2. Update batch qty
            prisma.hms_product_batch.updateMany({
                where: { id: lastInward.batch_id as string },
                data: { qty_on_hand: { increment: adjustment } }
            }),
            // 3. Log correction to ledger
            prisma.hms_stock_ledger.create({
                data: {
                    tenant_id: lastInward.tenant_id,
                    company_id: lastInward.company_id,
                    product_id: product.id,
                    movement_type: 'in',
                    qty: adjustment,
                    uom: 'PCS',
                    unit_cost: 0,
                    total_cost: 0,
                    reference: 'UOM-CORRECTION',
                    batch_id: lastInward.batch_id,
                    notes: 'Automated correction for packing unit receipt discrepancy'
                }
            })
        ])
        console.log("Stock corrected successfully")
    } else {
        console.log("No inward ledger found to correct")
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
