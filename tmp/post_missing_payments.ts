
import { prisma } from "../src/lib/prisma";
import { AccountingService } from "../src/lib/services/accounting";

async function postMissingPayments() {
    console.log("Starting Payment Recovery...");
    
    const invoices = await prisma.hms_invoice.findMany({
        where: { status: { in: ['paid', 'posted'] } },
        include: { hms_invoice_payments: true }
    });

    console.log(`Checking ${invoices.length} invoices...`);

    for (const inv of invoices) {
        if (inv.hms_invoice_payments.length > 0) {
            console.log(`Syncing Invoice: ${inv.invoice_number}`);
            await AccountingService.postSalesInvoice(inv.id);
        }
    }
    
    console.log("Payment Recovery Complete.");
}

postMissingPayments().catch(console.error);
