const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const run = async () => {
    const connectionString = 'postgresql://postgres:hms2035@localhost:5432/hms_db';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const config = await prisma.$queryRawUnsafe(`
            SELECT id, name, usage, is_default, updated_at, config->'coordinates' AS coordinates 
            FROM hms_invoice_printer_config 
            WHERE usage = 'sale_bill' 
            ORDER BY updated_at DESC 
            LIMIT 1
        `);
        console.log(JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
};

run();
