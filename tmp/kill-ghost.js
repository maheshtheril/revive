
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const receipts = await prisma.hms_purchase_receipt.findMany({
        where: { name: 'GRN-2026-0001' }
    });
    
    console.log(`Found ${receipts.length} receipts matching GRN-2026-0001`);
    
    for (const r of receipts) {
        console.log(`DELETING RECEIPT ID: ${r.id} for Tenant: ${r.tenant_id}`);
        
        // Forceful cleanup of all possible links
        await prisma.$transaction([
            prisma.$executeRawUnsafe(`DELETE FROM hms_purchase_receipt_line WHERE receipt_id = '${r.id}'`),
            prisma.$executeRawUnsafe(`DELETE FROM hms_purchase_return WHERE receipt_id = '${r.id}'`),
            prisma.$executeRawUnsafe(`DELETE FROM hms_stock_ledger WHERE related_id = '${r.id}'`),
            prisma.$executeRawUnsafe(`DELETE FROM hms_inventory_ledger WHERE related_id = '${r.id}'`),
            prisma.$executeRawUnsafe(`DELETE FROM hms_stock_move WHERE source_reference = '${r.id}'`),
            prisma.$executeRawUnsafe(`DELETE FROM hms_purchase_receipt WHERE id = '${r.id}'`)
        ]);
        
        console.log(`DELETED GRN-2026-0001 SUCCESSFULLY`);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());
