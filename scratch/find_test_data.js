const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- FETCHING DATA FOR VERIFICATION ---');
    
    // 1. Get recent products with batches
    const products = await prisma.hms_product.findMany({
      where: { is_active: true },
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        sku: true,
        hms_product_batch: {
          take: 1,
          orderBy: { created_at: 'desc' }
        },
        hms_product_stock_ledger: {
          take: 1,
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (products.length === 0) {
      console.log('No active products found.');
      return;
    }

    products.forEach(p => {
      console.log(`\nProduct: ${p.name} (SKU: ${p.sku})`);
      if (p.hms_product_batch.length > 0) {
        console.log(`  Last Batch: ${p.hms_product_batch[0].batch_no} (Created: ${p.hms_product_batch[0].created_at})`);
      }
      if (p.hms_product_stock_ledger.length > 0) {
        console.log(`  Last Move: ${p.hms_product_stock_ledger[0].movement_type} (Date: ${p.hms_product_stock_ledger[0].created_at})`);
      }
    });

    // 2. Get a specific date range that has data
    const lastMove = await prisma.hms_product_stock_ledger.findFirst({
      orderBy: { created_at: 'desc' }
    });

    if (lastMove) {
      const date = new Date(lastMove.created_at);
      const fromDate = new Date(date);
      fromDate.setDate(date.getDate() - 7);
      console.log(`\nSuggested Date Range: ${fromDate.toISOString().split('T')[0]} to ${date.toISOString().split('T')[0]}`);
    }

  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
