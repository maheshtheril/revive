'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/app/actions/upload-file";
import { getAIConfig } from "./settings";

async function getGenAIClient(companyId: string, tenantId: string) {
    const config = await getAIConfig(companyId, tenantId);
    if (!config?.enabled && config !== null) {
        throw new Error("AI Scanning is disabled in Settings.");
    }
    const key = config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!key) {
        throw new Error("Gemini API Key is missing. Please configure it in Global Settings.");
    }
    return new GoogleGenerativeAI(key);
}

async function getGenerativeModelWithFallback(genAI: GoogleGenerativeAI) {
    const models = [
        { name: "gemini-1.5-flash", version: "v1" as const },
        { name: "models/gemini-1.5-flash", version: "v1" as const },
        { name: "gemini-1.5-flash", version: "v1beta" as const },
        { name: "models/gemini-1.5-flash", version: "v1beta" as const },
        { name: "gemini-2.0-flash", version: "v1beta" as const },
        { name: "models/gemini-2.0-flash", version: "v1beta" as const },
        { name: "gemini-pro", version: "v1" as const }
    ];

    let lastError = null;
    for (const modelCfg of models) {
        try {
            const model = genAI.getGenerativeModel({ 
                model: modelCfg.name,
                generationConfig: { responseMimeType: "application/json" }
            }, { apiVersion: modelCfg.version });
            return model;
        } catch (e) {
            lastError = e;
            continue;
        }
    }
    throw lastError || new Error("Failed to initialize any AI model.");
}

export async function scanProductListAction(formData: FormData): Promise<{ success?: boolean; data?: any[]; error?: string }> {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const res = await uploadFile(formData, 'product_scans');
    if (res.error) return { error: res.error };
    if (!res.url) return { error: "Upload failed" };

    const fileUrl = res.url;
    
    try {
        const genAI = await getGenAIClient(session.user.companyId, session.user.tenantId || "");
        let base64Image = "";
        let mimeType = "image/jpeg";

        if (fileUrl.startsWith('data:')) {
            const parts = fileUrl.split(';base64,');
            if (parts.length !== 2) return { error: "Invalid Data URI format" };
            mimeType = parts[0].replace('data:', '');
            base64Image = parts[1];
        } else {
             return { error: "Expected Data URI but received something else." };
        }

        const prompt = `
            Analyze this product list / price list image and extract all products into strict JSON.
            
            Extract the following fields for each product:
            - "name": Full name of the medicine/product.
            - "packing": Packing details (e.g., "10'S", "1x15", "60 ML").
            - "mrp": Maximum Retail Price (Number).
            - "gst": GST Percentage if visible (e.g., 5, 12, 18).
            - "category": Detected category (e.g., "Pharmacy", "Surgical").
            
            Return ONLY a JSON array of objects.
            Example: [{"name": "PARACETAMOL", "packing": "10S", "mrp": 25.0, "gst": 12, "category": "Pharmacy"}]
        `;

        const model = await getGenerativeModelWithFallback(genAI);


        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                },
            },
        ]);

        const responseText = result.response.text();
        let data = JSON.parse(responseText);

        if (!Array.isArray(data)) {
            // If the model returned an object with an items key
            if (data.items) data = data.items;
            else if (data.products) data = data.products;
            else if (typeof data === 'object') {
                // If it's a single object that isn't an array, wrap it if it looks like a product
                data = [data];
            }
        }

        return { success: true, data };

    } catch (error: any) {
        console.error("Product Scan Error:", error);
        return { error: `Scan Failed: ${error.message}` };
    }
}

export async function scanPurchaseReceiptAction(formData: FormData): Promise<{ success?: boolean; data?: any[]; error?: string }> {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const res = await uploadFile(formData, 'receipt_scans');
    if (res.error) return { error: res.error };
    if (!res.url || !res.url.startsWith('data:')) return { error: "Invalid upload or Data URI missing" };

    const fileUrl = res.url;
    const parts = fileUrl.split(';base64,');
    const mimeType = parts[0].replace('data:', '');
    const base64Image = parts[1];
    
    try {
        const genAI = await getGenAIClient(session.user.companyId, session.user.tenantId || "");
        
        const prompt = `
            Analyze this PURCHASE RECEIPT / INVOICE image and extract all line items into strict JSON.
            
            Extract the following fields for each item:
            - "name": Full name of the product/item.
            - "quantity": Number of units received.
            - "unitCost": Purchase price per unit (before taxes).
            - "mrp": Sale price / MRP.
            - "batchNumber": Batch number (if visible).
            - "expiryDate": Expiry date in YYYY-MM-DD format (if visible, normalize it).
            
            Return ONLY a JSON array of objects.
            Example: [{"name": "PARACETAMOL 500", "quantity": 10, "unitCost": 12.5, "mrp": 25.0, "batchNumber": "BT123", "expiryDate": "2026-12-01"}]
        `;

        const model = await getGenerativeModelWithFallback(genAI);


        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                },
            },
        ]);

        const responseText = result.response.text();
        let data = JSON.parse(responseText);

        if (!Array.isArray(data)) {
            if (data.items) data = data.items;
            else if (data.products) data = data.products;
            else if (typeof data === 'object') data = [data];
        }

        return { success: true, data };

    } catch (error: any) {
        console.error("Receipt Scan Error:", error);
        return { error: `Receipt Scan Failed: ${error.message}` };
    }
}

export async function bulkImportProducts(products: any[]) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };
    
    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;
    const userId = session.user.id;

    try {
        let count = 0;
        
        // Pre-fetch data
        const [existingTaxes, existingCats] = await Promise.all([
            prisma.company_taxes.findMany({ 
                where: { company_id: companyId }, 
                select: { id: true, rate: true } 
            }),
            prisma.hms_product_category.findMany({ 
                where: { company_id: companyId }, 
                select: { id: true, name: true, default_tax_rate_id: true } 
            })
        ]);

        for (const item of products) {
            const sku = `PRD-${item.name.toUpperCase().replace(/\s+/g, '-').slice(0, 20)}-${Math.random().toString(36).substr(2, 4)}`;
            
            const product = await prisma.hms_product.upsert({
                where: {
                    tenant_id_sku: {
                        tenant_id: tenantId,
                        sku: sku
                    }
                },
                update: {
                    name: item.name,
                    price: item.mrp || 0,
                    metadata: {
                        packing: item.packing,
                        gst: item.gst,
                        imported_at: new Date().toISOString()
                    }
                },
                create: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    sku: sku,
                    name: item.name,
                    price: item.mrp || 0,
                    is_active: true,
                    is_stockable: true,
                    created_by: userId,
                    uom: item.packing?.includes('ML') ? 'BOTTLE' : 'UNIT',
                    metadata: {
                        packing: item.packing,
                        gst: item.gst
                    }
                }
            });

            // Handle Category Mapping
            let categoryId = null;
            if (item.category) {
                const existing = existingCats.find(c => c.name.toLowerCase() === item.category.toLowerCase());
                if (existing) {
                    categoryId = existing.id;
                } else {
                    const newCat = await prisma.hms_product_category.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: item.category
                        }
                    });
                    categoryId = newCat.id;
                    // @ts-ignore
                    existingCats.push(newCat);
                }

                // Link category to product
                await prisma.hms_product_category_rel.upsert({
                    where: { 
                        product_id_category_id: {
                            product_id: product.id,
                            category_id: categoryId
                        }
                    },
                    update: {},
                    create: {
                        product_id: product.id,
                        category_id: categoryId
                    }
                });
            }

            // Handle Tax Rule
            let finalTaxRateId = null;
            
            // 1. Try Scanned GST
            if (item.gst !== undefined && item.gst !== null) {
                const taxRateVal = parseFloat(item.gst);
                const match = existingTaxes.find(t => Math.abs(Number(t.rate) - taxRateVal) < 0.1);
                if (match) finalTaxRateId = match.id;
            }
            
            // 2. Fallback to Category default if no GST found in scan
            if (!finalTaxRateId && categoryId) {
                const cat = existingCats.find(c => c.id === categoryId);
                if (cat?.default_tax_rate_id) finalTaxRateId = cat.default_tax_rate_id;
            }

            if (finalTaxRateId) {
                const existingRule = await prisma.product_tax_rules.findFirst({
                    where: { product_id: product.id }
                });
                if (!existingRule) {
                    await prisma.product_tax_rules.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: product.id,
                            tax_rate_id: finalTaxRateId,
                            priority: 1
                        }
                    });
                }
            }

            count++;
        }
        return { success: true, count };
    } catch (error: any) {
        return { error: error.message };
    }
}
