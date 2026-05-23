import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SOURCE_COMPANY_ID = 'd19cd294-cec2-43a8-a953-376938132323';
const TARGET_COMPANY_ID = '6f7514ce-4b63-4ed9-a59e-c6e7cb1b2f57';
const TARGET_TENANT_ID = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';

async function migrateUOMs() {
    console.log("Starting UOM Master Migration...");
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch Source Categories
            const sourceCategories = await tx.hms_uom_category.findMany({
                where: { company_id: SOURCE_COMPANY_ID }
            });

            const categoryMap: Record<string, string> = {};

            // 2. Clone Categories to Target
            for (const cat of sourceCategories) {
                let targetCat = await tx.hms_uom_category.findFirst({
                    where: { company_id: TARGET_COMPANY_ID, name: cat.name }
                });

                if (!targetCat) {
                    targetCat = await tx.hms_uom_category.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: TARGET_TENANT_ID,
                            company_id: TARGET_COMPANY_ID,
                            name: cat.name
                        }
                    });
                }
                categoryMap[cat.id] = targetCat.id;
            }

            // 3. Fetch Source UOMs
            const sourceUOMs = await tx.hms_uom.findMany({
                where: { company_id: SOURCE_COMPANY_ID }
            });

            let migratedCount = 0;
            let updatedProductLinks = 0;

            // 4. Clone UOMs to Target
            for (const uom of sourceUOMs) {
                let targetUom = await tx.hms_uom.findFirst({
                    where: { company_id: TARGET_COMPANY_ID, name: uom.name }
                });

                const targetCategoryId = categoryMap[uom.category_id] || sourceCategories[0]?.id; // Fallback to first if mismatch

                if (!targetUom) {
                    targetUom = await tx.hms_uom.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: TARGET_TENANT_ID,
                            company_id: TARGET_COMPANY_ID,
                            category_id: targetCategoryId,
                            name: uom.name,
                            uom_type: uom.uom_type,
                            ratio: uom.ratio,
                            rounding: uom.rounding,
                            is_active: uom.is_active
                        }
                    });
                    migratedCount++;
                }

                // 5. Update Product links in Target Company
                const updateRes = await tx.hms_product.updateMany({
                    where: { 
                        company_id: TARGET_COMPANY_ID, 
                        uom: { equals: uom.name, mode: 'insensitive' } 
                    },
                    data: { uom_id: targetUom.id }
                });
                updatedProductLinks += updateRes.count;
            }

            console.log(`Migration Complete!`);
            console.log(`- Categories Synced: ${sourceCategories.length}`);
            console.log(`- UOMs Migrated: ${migratedCount}`);
            console.log(`- Product Links Repaired: ${updatedProductLinks}`);
        });
    } catch (error) {
        console.error("Migration Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateUOMs();
