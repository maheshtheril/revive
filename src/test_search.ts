import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testSearch(query: string, companyId: string) {
  const where: any = { company_id: companyId, is_active: true };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
      { default_barcode: { contains: query, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.hms_product.findMany({
    where,
    take: 10,
    select: { name: true, sku: true }
  });

  console.log(`Search results for "${query}":`, JSON.stringify(products, null, 2));
}

async function main() {
  // Get a companyId
  const company = await prisma.hms_company.findFirst({ select: { id: true } });
  if (!company) {
    console.log("No company found");
    return;
  }
  console.log("Testing with Company ID:", company.id);

  await testSearch("", company.id);
  await testSearch("a", company.id);
  await prisma.$disconnect();
}

main();
