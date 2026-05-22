import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * [SERIOUS-DATA-RECOVERY] Repair UOM Master
 * This route heals inventory data by reconstructing the UOM Master from existing product strings.
 * Use after migration or when 'missing uom' errors occur.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId!;

    try {
        const results = await prisma.$transaction(async (tx) => {
            // 1. Identify all products with UOM strings but missing or broken UOM links
            const products = await tx.hms_product.findMany({
                where: { company_id: companyId }
            });

            const uniqueUomNames = Array.from(new Set(products.map(p => (p.uom || 'PCS').toUpperCase().trim())));
            
            // 2. Ensure a "Standard Inventory" category exists for this company
            let standardCategory = await tx.hms_uom_category.findFirst({
                where: { company_id: companyId, name: 'Standard Units' }
            });

            if (!standardCategory) {
                standardCategory = await tx.hms_uom_category.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: 'Standard Units'
                    }
                });
            }

            // 3. Rebuild UOM Master
            const uomMap: Record<string, string> = {};
            for (const name of uniqueUomNames) {
                let uom = await tx.hms_uom.findFirst({
                    where: { company_id: companyId, name: { equals: name, mode: 'insensitive' } }
                });

                if (!uom) {
                    uom = await tx.hms_uom.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            category_id: standardCategory.id,
                            name: name,
                            uom_type: 'reference',
                            ratio: 1.0
                        }
                    });
                }
                uomMap[name] = uom.id;
            }

            // 4. Update products to point to correct UOM IDs
            let updatedCount = 0;
            for (const product of products) {
                const targetUomId = uomMap[(product.uom || 'PCS').toUpperCase().trim()];
                if (product.uom_id !== targetUomId) {
                    await tx.hms_product.update({
                        where: { id: product.id },
                        data: { uom_id: targetUomId }
                    });
                    updatedCount++;
                }
            }

            return {
                scanned: products.length,
                uniqueUomsCreated: uniqueUomNames.length,
                linksRepaired: updatedCount,
                uoms: uniqueUomNames
            };
        });

        return NextResponse.json({ 
            success: true, 
            message: "UOM Master Revived Successfully",
            ...results
        });
    } catch (error: any) {
        console.error("[REPAIR-UOM] Failure:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
