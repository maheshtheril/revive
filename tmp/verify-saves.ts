import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
    console.log("--- DB VERIFICATION START ---");
    
    const templates = await prisma.hms_print_template.findMany({
        where: {
            name: { in: ['11', '123', 'sss', 'salebill'] }
        },
        orderBy: { updated_at: 'desc' },
        select: {
            id: true,
            name: true,
            usage: true,
            company_id: true,
            is_active: true,
            updated_at: true
        }
    });

    console.log(`Found ${templates.length} target templates.`);
    console.table(templates);

    const configs = await prisma.hms_settings.findMany({
        where: {
            key: 'registration_config'
        },
        select: {
            company_id: true,
            value: true
        }
    });

    console.log("\n--- REGISTRATION CONFIGURATIONS ---");
    configs.forEach(c => {
        const val = c.value as any;
        console.log(`Company: ${c.company_id}`);
        console.log(`UsageDefaults:`, JSON.stringify(val?.usageDefaults || {}, null, 2));
    });

    console.log("--- DB VERIFICATION END ---");
}

verify()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
