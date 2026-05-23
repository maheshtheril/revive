
import { prisma } from "../src/lib/prisma";

async function repairReturns() {
    console.log("Starting Sales Return Ledger Repair...");
    
    const returns = await prisma.hms_sales_return.findMany({
        where: { status: 'posted' },
        include: { journal_entries: { include: { journal_entry_lines: true } } }
    });

    console.log(`Found ${returns.length} posted returns.`);

    for (const ret of returns) {
        if (ret.journal_entries.length > 0) {
            for (const journal of ret.journal_entries) {
                const linesWithoutPartner = journal.journal_entry_lines.filter(l => !l.partner_id);
                if (linesWithoutPartner.length > 0) {
                    console.log(`Updating ${linesWithoutPartner.length} lines for Return ${ret.return_number}`);
                    await prisma.journal_entry_lines.updateMany({
                        where: { 
                            journal_entry_id: journal.id,
                            partner_id: null
                        },
                        data: { partner_id: ret.patient_id }
                    });
                }
            }
        }
    }
    
    console.log("Repair Complete.");
}

repairReturns().catch(console.error);
