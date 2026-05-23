const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const companyId = '00000000-0000-0000-0000-000000000002';
    const today = new Date().toISOString().split('T')[0];
    const from = new Date(today);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setUTCHours(23, 59, 59, 999);

    console.log('Diagnostic for Company:', companyId);
    console.log('Date Range (UTC):', from.toISOString(), 'to', to.toISOString());

    try {
        const count = await prisma.hms_stock_ledger.count({
            where: {
                company_id: companyId,
                created_at: {
                    gte: from,
                    lte: to
                }
            }
        });
        console.log('Ledger Count for Today:', count);

        const samples = await prisma.hms_stock_ledger.findMany({
            where: { company_id: companyId },
            take: 5,
            include: { hms_product: true }
        });

        console.log('Samples Found (any date):', samples.length);
        samples.forEach(s => {
            console.log(`- Product: ${s.hms_product?.name}, Qty: ${s.qty}, Date: ${s.created_at.toISOString()}`);
        });

        if (samples.length > 0) {
            console.log('\nFirst Sample Details:');
            console.log(JSON.stringify(samples[0], (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            , 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
