import { prisma } from '../src/lib/prisma'

async function main() {
    // Fetch products with their batches and ledger entries
    const products = await prisma.hms_product.findMany({
        where: { hms_product_batch: { some: {} } },
        take: 5,
        include: {
            hms_stock_levels: true,
            hms_stock_ledger: { orderBy: { created_at: 'asc' } },
            hms_product_batch: true
        }
    })

    console.log(`Found ${products.length} products to audit...\n`)

    for (const product of products) {
        console.log(`\n===========================================`)
        console.log(`Product: ${product.name} (SKU: ${product.sku})`)
        console.log(`===========================================`)

        for (const batch of product.hms_product_batch) {
            console.log(`\nBatch: ${batch.batch_no} (ID: ${batch.id})`)
            console.log(`Current qty_on_hand in DB: ${batch.qty_on_hand}`)

            // Filter ledger entries for this batch
            const ledgerEntries = product.hms_stock_ledger.filter(l => l.batch_id === batch.id)
            
            let calculatedQty = 0;
            console.log(`\n--- Transaction History for Batch ---`)
            ledgerEntries.forEach(entry => {
                // Ensure qty is treated as a number
                const qty = Number(entry.qty)
                // If the system uses negative qty for out, we just add it, otherwise we subtract if movement_type is 'out'
                // Based on data: movement_type: 'out' sometimes has qty: '-1' and sometimes qty: '1'.
                // So the safest way is: if movement_type is 'out' and qty > 0, make it negative.
                let change = qty;
                if (entry.movement_type === 'out' && change > 0) {
                    change = -change;
                } else if (entry.movement_type === 'in' && change < 0) {
                    change = -change;
                }

                calculatedQty += change;
                console.log(`[${entry.created_at.toISOString()}] ${entry.movement_type.toUpperCase()} | Qty: ${change} | Related Type: ${entry.related_type} | Ref: ${entry.reference}`)
            })

            console.log(`-------------------------------------`)
            console.log(`Calculated Qty from Ledger: ${calculatedQty}`)
            console.log(`Matches Batch Qty on Hand? : ${Number(batch.qty_on_hand) === calculatedQty ? '✅ YES' : '❌ NO'}`)
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
