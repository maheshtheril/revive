
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const tenants = await prisma.hms_product.groupBy({
        by: ['tenant_id'],
        _count: { id: true }
    });
    console.log('PRODUCTS_BY_TENANT:');
    console.log(JSON.stringify(tenants, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
