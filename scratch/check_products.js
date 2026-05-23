const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { email: { contains: 'revive', mode: 'insensitive' } }
    });

    if (!tenant) {
      console.log('Tenant not found');
      return;
    }

    console.log(`Checking products for tenant: ${tenant.name} (${tenant.id})`);

    const products = await prisma.hms_product.findMany({
      where: {
        tenant_id: tenant.id,
        name: { contains: 'Reg', mode: 'insensitive' }
      },
      select: {
        name: true,
        price: true,
        is_service: true
      }
    });

    if (products.length === 0) {
      console.log('No registration products found');
    } else {
      console.table(products);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
