import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const categories = [
        "Pharmacy",
        "Surgical",
        "Lab Service",
        "Medical Services",
        "Registration Fee",
        "Administrative"
    ];

    const companies = await prisma.company.findMany();

    for (const company of companies) {
        console.log(`Processing ${company.name}...`);
        for (const catName of categories) {
            const found = await prisma.hms_product_category.findFirst({
                where: { name: catName, company_id: company.id }
            });
            if (!found) {
                await prisma.hms_product_category.create({
                    data: {
                        name: catName,
                        company_id: company.id,
                        tenant_id: company.tenant_id as string
                    }
                });
                console.log(`Created ${catName}`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
