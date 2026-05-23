const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function checkTemplates() {
    try {
        const templates = await prisma.hms_print_template.findMany({
            orderBy: { created_at: 'desc' }
        });

        const defaults = await prisma.hms_settings.findFirst({
            orderBy: { updated_at: 'desc' }
        });

        console.log(`\n=== DEFAULTS FROM HMS_SETTINGS ===`);
        console.log(`Usage Defaults:`, defaults?.usageDefaults);

        console.log(`\n=== TEMPLATES FOUND (${templates.length}) ===`);
        
        for (const t of templates) {
            console.log(`\n--- Template: ${t.name} ---`);
            console.log(`ID: ${t.id}`);
            console.log(`Usage: ${t.usage}`);
            if (t.usage === 'op_slip') {
                console.log(`\n[OP SLIP CONFIG DUMP]:`);
                console.log(JSON.stringify(t.config, null, 2).substring(0, 500) + '...');
            }
        }
    } catch (e) {
         console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkTemplates();
