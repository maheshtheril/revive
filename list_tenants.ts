
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('ALL_TENANTS:');
    console.log(JSON.stringify(tenants, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
