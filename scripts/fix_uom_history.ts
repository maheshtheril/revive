
import { prisma } from "../src/lib/prisma";

async function main() {
    const productId = 'be9cc101-e8f4-4a89-90d6-bdcaa920526c';
    
    // 1. Get all receipt lines for this product
    const lines = await prisma.hms_purchase_receipt_line.findMany({
        where: { product_id: productId }
    });
    
    console.log(`Analyzing ${lines.length} receipt lines...`);
    
    for (const line of lines) {
        const metadata = line.metadata as any || {};
        const packing = metadata.packing || metadata.purchase_uom || '';
        
        let shouldFactor = 1;
        if (packing.includes("100'S") || packing === 'BOX') {
            shouldFactor = 100;
        } else if (packing.includes("10'S") || packing === 'STRIP') {
            shouldFactor = 10;
        }
        
        if (shouldFactor > 1) {
            console.log(`Line ${line.id}: Found pack UOM (${packing}). Should factor by ${shouldFactor}.`);
            
            // Find corresponding ledger entries
            // Usually search by quantity and receipt_id (metadata in ledger?)
            // Wait, I check by reference.
            const receipt = await prisma.hms_purchase_receipt.findUnique({ where: { id: line.receipt_id } });
            if (receipt) {
                const ledgerEntries = await prisma.hms_stock_ledger.findMany({
                    where: { 
                        product_id: productId, 
                        reference: receipt.receipt_number,
                        qty: Number(line.qty) // match the original un-factored qty
                    }
                });
                
                for (const entry of ledgerEntries) {
                    const newQty = Number(line.qty) * shouldFactor;
                    console.log(`Fixing Ledger ${entry.id}: ${entry.qty} -> ${newQty}`);
                    await prisma.hms_stock_ledger.update({
                        where: { id: entry.id },
                        data: { qty: newQty }
                    });
                }
            }
        }
    }
    
    console.log("Triggering Final Re-calculation...");
    const aggregate = await prisma.hms_stock_ledger.aggregate({
        where: { product_id: productId },
        _sum: { qty: true }
    });
    const truth = Number(aggregate._sum.qty || 0);
    
    await prisma.hms_stock_levels.updateMany({
        where: { product_id: productId },
        data: { quantity: truth }
    });
    
    console.log(`STOCK RE-SYCHRONIZED. Total Pieces: ${truth}`);
}
main().finally(() => prisma.$disconnect());
