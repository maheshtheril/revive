
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fromId = '25e8940c-775d-458b-8b35-c1c9bb8526ab';
    const toId = 'be9cc101-e8f4-4a89-90d6-bdcaa920526c';
    
    console.log(`Merging ${fromId} into ${toId}...`);
    
    // 1. Move Ledger
    const moves = await prisma.hms_stock_ledger.updateMany({
        where: { product_id: fromId },
        data: { product_id: toId }
    });
    console.log(`Moved ${moves.count} ledger entries.`);
    
    // 2. Move Purchase Receipt Lines
    const prl = await prisma.hms_purchase_receipt_line.updateMany({
        where: { product_id: fromId },
        data: { product_id: toId }
    });
    console.log(`Moved ${prl.count} purchase lines.`);
    
    // 3. Move Invoice Lines
    const invl = await prisma.hms_invoice_lines.updateMany({
        where: { product_id: fromId },
        data: { product_id: toId }
    });
    console.log(`Moved ${invl.count} invoice lines.`);
    
    // 4. Delete From levels
    await prisma.hms_stock_levels.deleteMany({
        where: { product_id: fromId }
    });
    
    // 5. Delete From Batches
    await prisma.hms_product_batch.deleteMany({
        where: { product_id: fromId }
    });
    
    // 6. Delete the duplicate product
    await prisma.hms_product.delete({
        where: { id: fromId }
    });
    
    console.log("Merge complete. Triggering recalculation...");
    
    // 7. Manual Recalculate Truth for the target
    const aggregate = await prisma.hms_stock_ledger.aggregate({
        where: { product_id: toId },
        _sum: { qty: true }
    });
    const truth = Number(aggregate._sum.qty || 0);
    
    await prisma.hms_stock_levels.updateMany({
        where: { product_id: toId },
        data: { quantity: truth }
    });
    
    console.log(`Final Truth for SURAKSHA MASK: ${truth} pieces.`);
}
main().finally(() => prisma.$disconnect());
