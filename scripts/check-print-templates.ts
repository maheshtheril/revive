const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- SCANNING hms_print_template FOR sale_bill ---');
    const templates = await prisma.hms_print_template.findMany({
        where: { usage: 'sale_bill' },
        select: {
            id: true,
            name: true,
            usage: true,
            company_id: true,
            is_default: true,
            updated_at: true,
            config: true
        },
        orderBy: [
            { is_default: 'desc' },
            { updated_at: 'desc' }
        ]
    });

    console.log(`FOUND ${templates.length} TEMPLATES!`);
    
    templates.forEach((t: any, index: number) => {
        let hasPayable = false;
        let hasGrandTotal = false;
        
        try {
            const str = JSON.stringify(t.config);
            if (str.toLowerCase().includes('payable')) hasPayable = true;
            if (str.toLowerCase().includes('grand total')) hasGrandTotal = true;
        } catch (e) {}

        console.log(`\n[${index + 1}] ID: ${t.id}`);
        console.log(`    Name: ${t.name}`);
        console.log(`    Company ID: ${t.company_id}`);
        console.log(`    is_default: ${t.is_default}`);
        console.log(`    Updated: ${t.updated_at}`);
        console.log(`    Contains PAYABLE: ${hasPayable ? 'YES !!!' : 'NO'}`);
        console.log(`    Contains GRAND TOTAL: ${hasGrandTotal ? 'YES !!!' : 'NO'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
