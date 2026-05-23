const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const p = await prisma.hms_product.findMany({ 
            take: 5, 
            include: { hms_product_batch: true } 
        });
        console.log(JSON.stringify(p, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
