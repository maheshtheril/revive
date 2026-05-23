
import { prisma } from "../src/lib/prisma";
import { AccountingService } from "../src/lib/services/accounting";

async function forcePostReturns() {
    console.log("Force Posting Returns...");
    
    const returns = await prisma.hms_sales_return.findMany({
        where: { 
            return_number: { in: ['SRT-2026-0001', 'SRT-2026-0002'] }
        }
    });

    console.log(`Found ${returns.length} returns to post.`);

    for (const ret of returns) {
        console.log(`Posting Return: ${ret.return_number}`);
        const res = await AccountingService.postSalesReturn(ret.id);
        if (res.success) {
            console.log(`SUCCESS: ${ret.return_number}`);
        } else {
            console.log(`FAILED: ${ret.return_number} | Error: ${res.error || res.message}`);
        }
    }
    
    console.log("Force Post Complete.");
}

forcePostReturns().catch(console.error);
