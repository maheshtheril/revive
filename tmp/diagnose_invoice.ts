import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnose() {
    const id = "5399dc5d-c148-45a5-a000-0ac6d64079d2";
    console.log(`[DIAGNOSE] Searching for Invoice: ${id}`);
    
    const invoice = await prisma.hms_invoice.findUnique({
        where: { id: id }
    });

    if (!invoice) {
        console.log("[DIAGNOSE] RESULT: Invoice NOT FOUND in database.");
    } else {
        console.log(`[DIAGNOSE] RESULT: Found! Tenant: ${invoice.tenant_id} | Company: ${invoice.company_id}`);
    }
}

diagnose();
