import { prisma } from '@/lib/prisma';

export async function internalSeedUOMs(tenantId: string, companyId: string, tx?: any) {
    const db = tx || prisma;
    console.log(`[UOM Service] Seeding UOMs for Tenant: ${tenantId}, Company: ${companyId}`);
    try {
        // 0. MIGRATION: Normalize 'each' to 'EACH'
        // This cleans up previous duplicate seeds
        console.log("[UOM Service] Normalizing UOMs (each -> EACH)...");
        try {
            // Update products to use 'EACH'
            await db.hms_product.updateMany({
                where: { uom: 'each' },
                data: { uom: 'EACH' }
            });

            // Find the lowercase UOM record to delete it
            const lowercaseEach = await db.hms_uom.findFirst({
                where: { tenant_id: tenantId, company_id: companyId, name: 'each' }
            });
            if (lowercaseEach) {
                await db.hms_uom.delete({ where: { id: lowercaseEach.id } });
                console.log("[UOM Service] Deleted duplicate lowercase 'each' UOM.");
            }
        } catch (migError) {
            console.warn("[UOM Service] Migration warning (non-fatal):", migError);
        }

        // 1. Ensure Categories
        const categories = [
            'Pharmaceutical Packaging', 
            'Generic Units', 
            'Volume', 
            'Weight', 
            'Services'
        ];
        const catMap: Record<string, any> = {};

        for (const catName of categories) {
            let cat = await db.hms_uom_category.findFirst({
                where: { tenant_id: tenantId, company_id: companyId, name: catName }
            });

            if (!cat) {
                cat = await db.hms_uom_category.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: catName
                    }
                });
            }
            catMap[catName] = cat;
        }

        const pharmaCat = catMap['Pharmaceutical Packaging'];
        const genericCat = catMap['Generic Units'];
        const volCat = catMap['Volume'];
        const weightCat = catMap['Weight'];
        const serviceCat = catMap['Services'];

        // 2. Define world-standard UOMs
        const uomDefinitions = [
            // Generic
            { name: 'EACH', type: 'reference', ratio: 1.0, description: 'Each / Single Unit', categoryId: genericCat.id },
            { name: 'PCS', type: 'reference', ratio: 1.0, description: 'Pieces', categoryId: genericCat.id },
            { name: 'UNIT', type: 'reference', ratio: 1.0, description: 'Standard Unit', categoryId: genericCat.id },
            { name: 'NOS', type: 'reference', ratio: 1.0, description: 'Numbers', categoryId: genericCat.id },

            // Pharma Packaging
            { name: 'TAB', type: 'reference', ratio: 1.0, description: 'Tablet', categoryId: pharmaCat.id },
            { name: 'CAP', type: 'reference', ratio: 1.0, description: 'Capsule', categoryId: pharmaCat.id },
            { name: 'STRIP', type: 'reference', ratio: 1.0, description: 'Strip', categoryId: pharmaCat.id },
            { name: 'VIAL', type: 'reference', ratio: 1.0, description: 'Vial', categoryId: pharmaCat.id },
            { name: 'AMPOULE', type: 'reference', ratio: 1.0, description: 'Ampoule', categoryId: pharmaCat.id },
            { name: 'BOTTLE', type: 'reference', ratio: 1.0, description: 'Bottle', categoryId: pharmaCat.id },
            { name: 'PACK', type: 'reference', ratio: 1.0, description: 'Pack', categoryId: pharmaCat.id },
            { name: 'BOX', type: 'reference', ratio: 1.0, description: 'Box', categoryId: pharmaCat.id },

            // Weight
            { name: 'MG', type: 'reference', ratio: 1.0, description: 'Milligram', categoryId: weightCat.id },
            { name: 'G', type: 'bigger', ratio: 1000.0, description: 'Gram', categoryId: weightCat.id },
            { name: 'KG', type: 'bigger', ratio: 1000000.0, description: 'Kilogram', categoryId: weightCat.id },
            { name: 'MCG', type: 'smaller', ratio: 0.001, description: 'Microgram', categoryId: weightCat.id },

            // Volume
            { name: 'ML', type: 'reference', ratio: 1.0, description: 'Milliliter', categoryId: volCat.id },
            { name: 'L', type: 'bigger', ratio: 1000.0, description: 'Liter', categoryId: volCat.id },

            // Services
            { name: 'VISIT', type: 'reference', ratio: 1.0, description: 'Consultation Visit', categoryId: serviceCat.id },
            { name: 'TEST', type: 'reference', ratio: 1.0, description: 'Lab Test', categoryId: serviceCat.id },
            { name: 'SCAN', type: 'reference', ratio: 1.0, description: 'Radiology Scan', categoryId: serviceCat.id },
            { name: 'SESSION', type: 'reference', ratio: 1.0, description: 'Procedure Session', categoryId: serviceCat.id },
            { name: 'DAY', type: 'reference', ratio: 1.0, description: 'Day (IPD)', categoryId: serviceCat.id },
        ];

        // 3. Seed UOMs
        let createdCount = 0;
        for (const uomDef of uomDefinitions) {
            const existing = await db.hms_uom.findFirst({
                where: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    name: uomDef.name
                }
            });

            if (!existing) {
                await db.hms_uom.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        category_id: uomDef.categoryId,
                        name: uomDef.name,
                        uom_type: uomDef.type,
                        ratio: uomDef.ratio,
                        is_active: true
                    }
                });
                createdCount++;
            }
        }

        return {
            success: true,
            message: `Seeded ${createdCount} new UOMs`
        };
    } catch (error) {
        console.error("Error in internalSeedUOMs:", error);
        throw error;
    }
}
