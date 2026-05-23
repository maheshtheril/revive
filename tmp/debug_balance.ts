
import { prisma } from "../src/lib/prisma";

async function debugBalance() {
    const patientId = process.argv[2];
    if (!patientId) {
        console.log("Please provide patientId");
        return;
    }

    console.log(`Debugging Balance for Patient: ${patientId}`);

    const ledgerLines = await prisma.journal_entry_lines.findMany({
        where: { partner_id: patientId },
        include: { journal_entries: true }
    });

    console.log(`Found ${ledgerLines.length} ledger lines.`);
    
    let totalDebit = 0;
    let totalCredit = 0;

    ledgerLines.forEach(l => {
        console.log(`- Line: ${l.description} | Debit: ${l.debit} | Credit: ${l.credit} | Posted: ${l.journal_entries?.posted}`);
        if (l.journal_entries?.posted) {
            totalDebit += Number(l.debit);
            totalCredit += Number(l.credit);
        }
    });

    console.log(`TOTAL DEBIT: ${totalDebit}`);
    console.log(`TOTAL CREDIT: ${totalCredit}`);
    console.log(`NET BALANCE (Debit - Credit): ${totalDebit - totalCredit}`);
}

debugBalance().catch(console.error);
