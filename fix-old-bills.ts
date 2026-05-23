import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fetching invoices with missing invoice_no or invoice_date...");
    
    const invoices = await prisma.hms_invoice.findMany({
        where: {
            OR: [
                { invoice_no: null },
                { invoice_date: null }
            ]
        },
        select: {
            id: true,
            invoice_number: true,
            issued_at: true
        }
    });

    console.log(`Found ${invoices.length} invoices to fix.`);

    let count = 0;
    for (const inv of invoices) {
        await prisma.hms_invoice.update({
            where: { id: inv.id },
            data: {
                invoice_no: inv.invoice_number,
                invoice_date: inv.issued_at
            }
        });
        count++;
    }

    console.log(`Successfully updated ${count} old bills!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
