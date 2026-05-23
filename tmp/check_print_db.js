const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const config = await prisma.$queryRaw`
            SELECT id, name, usage, is_default, updated_at, config->'coordinates' AS coordinates 
            FROM hms_invoice_printer_config 
            WHERE usage = 'sale_bill' 
            ORDER BY updated_at DESC 
            LIMIT 1
        `;
        console.log(JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
