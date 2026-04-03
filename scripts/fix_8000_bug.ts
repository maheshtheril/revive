
import { prisma } from "../src/lib/prisma";

async function main() {
    const reference = 'INV-26-27-00003';
    console.log(`Fixing ledger for ${reference}...`);
    
    const records = await prisma.hms_stock_ledger.findMany({
        where: { reference }
    });
    
    for (const r of records) {
        if (Number(r.qty) === -8000) {
            console.log(`Restoring Record ${r.id} from -8000 to -80`);
            await prisma.hms_stock_ledger.update({
                where: { id: r.id },
                data: { qty: -80 }
            });
            
            // Recalculate level for this product
            const aggregate = await prisma.hms_stock_ledger.aggregate({
                where: { product_id: r.product_id },
                _sum: { qty: true }
            });
            const truth = Number(aggregate._sum.qty || 0);
            await prisma.hms_stock_levels.updateMany({
                where: { product_id: r.product_id },
                data: { quantity: truth }
            });
            console.log(`Product ${r.product_id} restored to ${truth} pieces.`);
        }
    }
}
main().finally(() => prisma.$disconnect());
