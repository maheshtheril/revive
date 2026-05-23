
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const recentLedger = await prisma.hms_stock_ledger.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: { hms_product: { select: { name: true } } }
    });
    console.log('RECENT_MOVEMENTS:');
    recentLedger.forEach(l => {
        console.log(`${l.created_at.toISOString()} | ${l.movement_type} | ${l.hms_product?.name} | qty: ${l.qty} | ref: ${l.reference}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
