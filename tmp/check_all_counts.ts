import { prisma } from "../src/lib/prisma";

async function main() {
    const tenantId = '41537389-7316-4a86-97a3-de21ff9833f7';
    
    const modelsToCheck = [
        'hms_product',
        'hms_product_batch',
        'hms_product_category',
        'hms_manufacturer',
    ];

    console.log(`Checking counts for tenant: ${tenantId}\n`);

    for (const model of modelsToCheck) {
        try {
            const count = await (prisma as any)[model].count({
                where: { tenant_id: tenantId }
            });
            console.log(`${model}: ${count}`);
        } catch (e) {
            console.log(`${model}: Error or not found - ${e}`);
        }
    }

    console.log(`\nChecking counts across ALL tenants\n`);
    for (const model of modelsToCheck) {
        try {
            const count = await (prisma as any)[model].count();
            console.log(`${model}: ${count}`);
        } catch (e) {
            console.log(`${model}: Error or not found - ${e}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
