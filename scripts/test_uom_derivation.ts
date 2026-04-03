
import { prisma } from "../src/lib/prisma";

async function testUomLogic() {
    const productId = 'be9cc101-e8f4-4a89-90d6-bdcaa920526c';
    const product = await prisma.hms_product.findUnique({ where: { id: productId } });
    
    if (!product) {
        console.log("Product not found");
        return;
    }
    
    const metadata = product.metadata as any;
    const uomData = metadata?.uom_data || {};
    
    console.log("Product Name:", product.name);
    console.log("Product UOM (Field):", product.uom);
    console.log("Product Metadata:", JSON.stringify(metadata, null, 2));
    
    // Mocking the getUomOptions logic
    const packUom = (
        metadata?.purchase_uom || uomData.purchase_uom || 
        metadata?.packUom || uomData.packUom || 
        uomData.pack_uom || metadata?.pack_uom || 
        'BOX'
    ).toString().toUpperCase();

    const baseUom = (
        metadata?.base_uom || uomData.base_uom || 
        metadata?.baseUom || uomData.baseUom || 
        'PCS'
    ).toString().toUpperCase();
    
    const relevantUnits = Array.from(new Set([
        packUom,
        baseUom,
        (product.uom || '').toUpperCase(),
        'PCS',
        'UNT'
    ])).filter(u => u && u !== 'UNDEFINED' && u !== 'NULL' && u.length > 0);
    
    console.log("EXPECTED DROPDOWN OPTIONS:", relevantUnits);
}

testUomLogic();
