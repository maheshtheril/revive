import { prisma } from '../src/lib/prisma';

async function main() {
    const lines = await (prisma as any).hms_invoice_lines.findMany({
        where: {
            description: { contains: 'Registration', mode: 'insensitive' }
        },
        include: {
            hms_invoice: {
                select: { id: true, invoice_number: true, created_at: true, patient_id: true }
            }
        },
        orderBy: { created_at: 'desc' },
        take: 20
    });
    
    console.log(JSON.stringify(lines.map(l => ({
        invoiceId: l.hms_invoice.invoice_number,
        patientId: l.hms_invoice.patient_id,
        desc: l.description,
        price: l.unit_price,
        time: l.created_at
    })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
