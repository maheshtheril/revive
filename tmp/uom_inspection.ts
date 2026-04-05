import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const p = await (prisma as any).hms_product.findFirst({
        where: { name: { contains: 'ON CALL PLUS STRIPS', mode: 'insensitive' } },
        include: {
            hms_product_batch: {
                orderBy: { created_at: 'desc' },
                take: 1
            },
            hms_purchase_receipt_line: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        }
    });

    if (!p) {
        console.log('No item found');
        return;
    }

    console.log('--- PRODUCT DATA ---');
    console.log('Name:', p.name);
    console.log('Base UOM:', p.uom);

    if (p.hms_product_batch[0]) {
        const b = p.hms_product_batch[0];
        console.log('--- BATCH DATA ---');
        console.log('Batch No:', b.batch_no);
        console.log('Cost:', b.cost?.toString());
        console.log('MRP:', b.mrp?.toString());
        console.log('Qty:', b.qty_on_hand?.toString());
    }

    if (p.hms_purchase_receipt_line[0]) {
        const l = p.hms_purchase_receipt_line[0];
        console.log('--- RECEIPT LINE DATA ---');
        console.log('Receipt Line ID:', l.id);
        console.log('Unit Price:', l.unit_price?.toString());
        console.log('Batch ID on Line:', l.batch_id);
        console.log('Metadata:', JSON.stringify(l.metadata, null, 2));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
