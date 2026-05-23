
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const firstProd = await prisma.hms_product.findFirst({
        orderBy: { created_at: 'asc' },
        select: { created_at: true, name: true }
    });
    const lastProd = await prisma.hms_product.findFirst({
        orderBy: { created_at: 'desc' },
        select: { created_at: true, name: true }
    });
    console.log(`FIRST_PRODUCT: ${firstProd?.name} at ${firstProd?.created_at?.toISOString()}`);
    console.log(`LAST_PRODUCT: ${lastProd?.name} at ${lastProd?.created_at?.toISOString()}`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
