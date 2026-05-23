import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const id = '2aefcb27-c298-49b6-ae91-dd85ab4a055c';
    const invoice = await prisma.hms_invoice.findFirst({
        where: {
            OR: [
                { id: id },
                { invoice_number: id }
            ]
        }
    });
    console.log("Invoice found:", invoice ? invoice.id : "null");
}

main().catch(console.error).finally(() => prisma.$disconnect());
