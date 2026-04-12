import { prisma } from "../src/lib/prisma";

async function main() {
    const products = await prisma.hms_product.groupBy({
        by: ['tenant_id'],
        _count: { id: true }
    });
    console.log("Product Counts per Tenant:");
    console.log(JSON.stringify(products, null, 2));

    const batches = await prisma.hms_product_batch.groupBy({
        by: ['tenant_id'],
        _count: { id: true }
    });
    console.log("\nBatch Counts per Tenant:");
    console.log(JSON.stringify(batches, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
