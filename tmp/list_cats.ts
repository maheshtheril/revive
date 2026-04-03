
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const cats = await prisma.hms_product_category.findMany();
    console.log("CATEGORIES:", cats.map(c => c.name));
    process.exit(0);
}
main();
