require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.hms_product_batch.groupBy({
    by: ['product_id'],
    _count: {
      id: true
    },
    having: {
      product_id: {
        _count: {
          gt: 1
        }
      }
    }
  });

  console.log(`Found ${batches.length} products with multiple batches.`);

  for (const b of batches.slice(0, 5)) {
    const product = await prisma.hms_product.findUnique({
      where: { id: b.product_id },
      select: { name: true, sku: true }
    });
    
    const batchDetails = await prisma.hms_product_batch.findMany({
        where: { product_id: b.product_id },
        select: { batch_no: true, qty_on_hand: true, expiry_date: true }
    });

    console.log(`\nProduct: ${product?.name} (SKU: ${product?.sku})`);
    console.log(`Batches:`);
    batchDetails.forEach(bd => {
        console.log(` - ${bd.batch_no}: Qty ${bd.qty_on_hand}, Exp: ${bd.expiry_date}`);
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
