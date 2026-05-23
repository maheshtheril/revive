require('dotenv').config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const fallbackCompany = await prisma.company.findFirst({
            orderBy: { created_at: 'asc' }
        });
        console.log("Fallback company:", fallbackCompany?.id);
        
        if (fallbackCompany) {
            const company = await prisma.company.findUnique({
                where: { id: fallbackCompany.id },
                include: { company_settings: true }
            });
            console.log("Fetched company:", company?.id);
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
