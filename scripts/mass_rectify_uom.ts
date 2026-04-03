
import { prisma } from "../src/lib/prisma";

async function massRectifyProducts() {
    console.log("MASS RECTIFICATION INITIATED - STANDARDIZING ALL PRODUCT METADATA...");
    
    const products = await prisma.hms_product.findMany({});
    console.log(`Found ${products.length} products to audit.`);
    
    for (const p of products) {
        const metadata = p.metadata as any || {};
        const uomData = metadata.uom_data || {};
        
        // Ensure every product has a clean, flattened UOM structure for the UI fix
        const baseUom = (metadata.base_uom || uomData.base_uom || p.uom || 'PCS').toString().toUpperCase();
        const purchaseUom = (metadata.purchase_uom || uomData.purchase_uom || metadata.pack_uom || uomData.pack_uom || '').toString().toUpperCase();
        
        await prisma.hms_product.update({
            where: { id: p.id },
            data: {
                metadata: {
                    ...metadata,
                    // Flattened UI fields
                    purchase_uom: purchaseUom,
                    base_uom: baseUom,
                    // Normalized UOM structure
                    uom_data: {
                        ...uomData,
                        base_uom: baseUom,
                        purchase_uom: purchaseUom,
                        conversion_factor: Number(uomData.conversion_factor || 1)
                    }
                }
            }
        });
    }
    
    console.log("SUCCESS: ALL PRODUCT MASTERS RECTIFIED AND STANDARDIZED.");
}

massRectifyProducts().finally(() => prisma.$disconnect());
