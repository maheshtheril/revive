
import { prisma } from "../src/lib/prisma";

async function auditAccountUsage() {
    const patientId = process.argv[2];
    if (!patientId) {
        console.log("Please provide patientId");
        return;
    }

    console.log(`Auditing Account Usage for Patient: ${patientId}`);

    const ledgerLines = await prisma.journal_entry_lines.findMany({
        where: { partner_id: patientId },
        include: { accounts: true }
    });

    console.log(`Found ${ledgerLines.length} ledger lines.`);
    
    const accountSummary = new Map();

    ledgerLines.forEach(l => {
        const key = `${l.accounts.code} - ${l.accounts.name} (${l.account_id})`;
        const current = accountSummary.get(key) || { debit: 0, credit: 0, count: 0 };
        current.debit += Number(l.debit);
        current.credit += Number(l.credit);
        current.count++;
        accountSummary.set(key, current);
    });

    for (const [acc, data] of accountSummary.entries()) {
        console.log(`\nACCOUNT: ${acc}`);
        console.log(`  Count: ${data.count} lines`);
        console.log(`  Total Debit: ${data.debit}`);
        console.log(`  Total Credit: ${data.credit}`);
        console.log(`  NET: ${data.debit - data.credit}`);
    }
}

auditAccountUsage().catch(console.error);
