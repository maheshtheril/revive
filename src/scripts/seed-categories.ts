import { prisma } from "../lib/prisma";

async function seedCategories() {
    // We need to fetch a valid company/tenant to seed. 
    // Normally this should be per session, but for a global setup we'll target all companies found or a specific one.
    // For the user, we'll try to find the main company first.

    const companies = await prisma.company.findMany();

    if (companies.length === 0) {
        console.log("No companies found to seed categories.");
        return;
    }

    const standardCategories = [
        { name: "Pharmacy", isStockable: true },
        { name: "Surgical", isStockable: true },
        { name: "Laboratory", isStockable: false },
        { name: "Medical Services", isStockable: false },
        { name: "Registration Fees", isStockable: false },
        { name: "Nursing", isStockable: false },
        { name: "Consultation", isStockable: false }
    ];

    for (const company of companies) {
        console.log(`Seeding categories for company: ${company.name}`);

        for (const cat of standardCategories) {
            const existing = await prisma.hms_product_category.findFirst({
                where: {
                    company_id: company.id,
                    name: { equals: cat.name, mode: 'insensitive' }
                }
            });

            if (!existing) {
                await prisma.hms_product_category.create({
                    data: {
                        tenant_id: company.tenant_id as string,
                        company_id: company.id,
                        name: cat.name,
                        metadata: { is_standard: true, suggested_stockable: cat.isStockable }
                    }
                });
                console.log(`Created: ${cat.name}`);
            } else {
                console.log(`Exists: ${cat.name}`);
            }
        }
    }
}

seedCategories()
    .then(() => console.log("Seeding complete."))
    .catch((e) => console.error(e))
    .finally(() => process.exit(0));
