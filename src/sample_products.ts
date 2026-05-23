import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.hms_product.findMany({
    take: 20,
    select: { name: true, is_active: true, is_stockable: true, is_service: true, company_id: true }
  });
  console.log("Products Sample:", JSON.stringify(products, null, 2));
  await prisma.$disconnect();
}

main();
