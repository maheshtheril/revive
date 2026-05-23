
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const total = await prisma.hms_product.count();
    const active = await prisma.hms_product.count({ where: { is_active: true } });
    console.log(`TOTAL_PRODUCTS: ${total}`);
    console.log(`ACTIVE_PRODUCTS: ${active}`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
