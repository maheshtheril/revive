import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const products = await prisma.hms_product.findMany({
        take: 5,
        select: { id: true, name: true, company_id: true, tenant_id: true }
    });
    console.log(JSON.stringify(products, null, 2));
}
run();
