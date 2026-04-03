
import { prisma } from "../src/lib/prisma";

async function main() {
    const id = process.argv[2] || 'be9cc101-e8f4-4a89-90d6-bdcaa920526c';
    const records = await prisma.hms_stock_ledger.findMany({
        where: { product_id: id },
        orderBy: { created_at: 'asc' }
    });
    
    const product = await prisma.hms_product.findUnique({ where: { id } });
    
    console.log(`\nLEDGER FOR: ${product?.name} (${id})`);
    let balance = 0;
    console.log("DATE | TYPE | QTY | BALANCE | REF");
    console.log("-------------------------------------");
    for (const r of records) {
        const qty = Number(r.qty);
        balance += qty;
        console.log(`${r.created_at.toISOString().split('T')[0]} | ${r.movement_type.padStart(4)} | ${qty.toString().padStart(4)} | ${balance.toString().padStart(7)} | ${r.reference}`);
    }
}
main().finally(() => prisma.$disconnect());
