require('dotenv').config();
import { PrismaClient } from '@prisma/client';

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
        }
    });

    console.log(`FOUND ${templates.length} TEMPLATES!`);
    
    let updatedCount = 0;
    
    for (const t of templates) {
        if (!t.config) continue;
        
        let hasPayable = false;
        try {
            let str = JSON.stringify(t.config);
            if (str.toLowerCase().includes('payable') || str.toLowerCase().includes('final payable')) {
                hasPayable = true;
                console.log(`\n[!] FOUND 'PAYABLE' IN TEMPLATE ID: ${t.id} (Name: ${t.name}, Company: ${t.company_id})`);
                
                // Nuclear Replace
                str = str.replace(/Final Payable/gi, "GRAND TOTAL")
                         .replace(/FINAL PAYABLE/g, "GRAND TOTAL")
                         .replace(/Payable/gi, "Total")
                         .replace(/PAYABLE/g, "TOTAL");
                         
                await prisma.hms_print_template.update({
                    where: { id: t.id },
                    data: { config: JSON.parse(str) }
                });
                
                console.log(`    > SUCCESSFULLY NUKED AND REPLACED WITH 'GRAND TOTAL'`);
                updatedCount++;
            }
        } catch (e) {
            console.log("Error parsing template:", e);
        }
    }
    
    console.log(`\n=== NUCLEAR OVERRIDE COMPLETE: ${updatedCount} TEMPLATES FIXED ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
