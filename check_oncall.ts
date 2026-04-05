import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.hms_product.findMany({
    where: { name: { contains: 'ON CALL PLUS STRIPS', mode: 'insensitive' } },
    include: {
      hms_stock_levels: true,
      hms_product_batch: true
    }
  });
  console.log(JSON.stringify(products, null, 2));
}
run().then(() => prisma.$disconnect());
