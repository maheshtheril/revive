import { prisma } from '../src/lib/prisma';

async function checkDB() {
    console.log("Checking DB duplicates...");
    const dups = await prisma.$queryRawUnsafe(`
        SELECT tenant_id, company_id, lower(name), usage, count(*) as count
        FROM hms_print_template
        GROUP BY tenant_id, company_id, lower(name), usage
        HAVING count(*) > 1
    `);
    console.log("True DB Duplicates:", dups);

    const all = await prisma.$queryRawUnsafe(`
        SELECT id, name, usage, is_active FROM hms_print_template
    `);
    console.log("All templates:", all);
}
checkDB().catch(console.error).finally(()=>process.exit(0));
