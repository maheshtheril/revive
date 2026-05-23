
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const totalStock = await prisma.hms_stock_levels.count();
    const sumQty = await prisma.hms_stock_levels.aggregate({
        _sum: { quantity: true }
    });
    console.log(`TOTAL_STOCK_RECORDS: ${totalStock}`);
    console.log(`SUM_QUANTITY: ${sumQty._sum.quantity}`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
