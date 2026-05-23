import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const globalMedicare = await prisma.company.findFirst({
            where: { name: { contains: 'Global Medicare', mode: 'insensitive' } },
            select: { id: true, name: true }
        });

        if (!globalMedicare) {
            console.log("Company 'Global Medicare' not found.");
            return;
        }

        const uomCount = await prisma.hms_uom.count({
            where: { company_id: globalMedicare.id }
        });

        const uoms = await prisma.hms_uom.findMany({
            where: { company_id: globalMedicare.id },
            select: { name: true, uom_type: true }
        });

        console.log(`Company: ${globalMedicare.name} (ID: ${globalMedicare.id})`);
        console.log(`Total UOMs: ${uomCount}`);
        console.log("Units:", uoms.map(u => u.name).join(", "));
    } catch (error) {
        console.error("Error querying UOMs:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
