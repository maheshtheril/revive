import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting Registration Fee fixing script...");
    
    // 1. Update product masters
    const result = await prisma.hms_product.updateMany({
        where: { sku: 'REG-FEE' },
        data: { price: 150 }
    });
    console.log(`Updated ${result.count} products with SKU 'REG-FEE' to 150rs.`);
    
    // 2. Look for settings that might have 100 hardcoded
    const settings = await prisma.hms_settings.findMany({
        where: { key: 'registration_config' }
    });
    
    let configUpdated = 0;
    for (const setting of settings) {
        let value = setting.value as any;
        if (value && value.fee && Number(value.fee) === 100) {
            value.fee = 150;
            await prisma.hms_settings.update({
                where: { id: setting.id },
                data: { value }
            });
            configUpdated++;
        }
    }
    console.log(`Updated ${configUpdated} hms_settings rows to 150rs.`);
    
}

main().catch(console.error).finally(() => prisma.$disconnect());
