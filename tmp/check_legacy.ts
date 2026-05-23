import { prisma } from '../src/lib/prisma';

async function checkLegacyBlobs() {
    console.log("Checking hms_settings for legacy templates...");
    
    const records = await prisma.hms_settings.findMany({
        where: {
            key: { in: ['registration_config', 'pdf_print_config'] }
        }
    });

    for (const record of records) {
        const data = record.value as any;
        if (data && Array.isArray(data.templates) && data.templates.length > 0) {
            console.log(`\nCompany ${record.company_id} [${record.key}]:`);
            console.log(`Has ${data.templates.length} templates.`);
            const names = data.templates.map((t: any) => `${t.name} (${t.usage})`);
            console.log(names);
        }
    }
}

checkLegacyBlobs().catch(console.error).finally(() => process.exit(0));
