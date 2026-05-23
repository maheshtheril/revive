import { prisma } from '../src/lib/prisma';

async function main() {
    const templates = await prisma.$queryRawUnsafe(`
        SELECT id, name, usage, company_id, tenant_id, is_default, updated_at
        FROM hms_print_template
        ORDER BY name, usage, updated_at DESC
    `);
    console.log(templates);
    process.exit(0);
}
main().catch(console.error);
