'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { serialize } from "@/lib/utils"
import { SYSTEM_DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency"
import crypto from 'crypto';
import { Prisma } from "@prisma/client";

// --- SEARCH & RESOLUTION ACTIONS (Extracted for Stability) ---

export async function getSuppliersList(query?: string, page: number = 1) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = { company_id: session.user.companyId, is_active: true };
        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { contact_name: { contains: query, mode: 'insensitive' } },
            ];
        }
        const [suppliers, total] = await prisma.$transaction([
            prisma.hms_supplier.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { name: 'asc' }
            }),
            prisma.hms_supplier.count({ where })
        ]);

        return {
            success: true,
            data: suppliers.map(s => ({
                id: s.id,
                name: s.name,
                gstin: (s.metadata as any)?.gstin || (s.metadata as any)?.GSTIN || ''
            })),
            meta: { total, page, totalPages: Math.ceil(total / pageSize) }
        };
    } catch (error) {
        return { error: "Failed to fetch suppliers" };
    }
}

export async function getProductsPremium(query?: string, page: number = 1, supplierId?: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pageSize = 100;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = { company_id: session.user.companyId, is_active: true };
        if (supplierId) {
            const supplierProductIds = await prisma.hms_purchase_receipt_line.findMany({
                where: {
                    hms_purchase_receipt: {
                        supplier_id: supplierId,
                        company_id: session.user.companyId
                    }
                },
                select: { product_id: true }
            });
            const uniqueIds = Array.from(new Set(supplierProductIds.map(sp => sp.product_id)));
            if (uniqueIds.length > 0) where.id = { in: uniqueIds };
            else where.id = "NOT_FOUND";
        }

        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
                { default_barcode: { contains: query, mode: 'insensitive' } },
            ];
        }

        const [products, total, companySettings] = await prisma.$transaction([
            prisma.hms_product.findMany({
                where, skip, take: pageSize,
                orderBy: { created_at: 'desc' },
                include: {
                    hms_stock_levels: { select: { quantity: true } },
                    hms_product_category_rel: { include: { hms_product_category: true } },
                    hms_uom: true
                }
            }),
            prisma.hms_product.count({ where }),
            prisma.company_settings.findUnique({
                where: { company_id: session.user.companyId },
                select: { currencies: { select: { symbol: true } } }
            })
        ]);

        const processed = products.map(p => {
            const totalStock = p.hms_stock_levels.reduce((sum, lvl) => sum + Number(lvl.quantity || 0), 0);
            const metadata = p.metadata as Record<string, any> || {};
            const { hms_stock_levels, ...rest } = p;
            return {
                ...rest,
                price: Number(p.price || 0),
                totalStock,
                stockStatus: totalStock === 0 ? 'Out of Stock' : totalStock < 10 ? 'Low Stock' : 'In Stock',
                category: p.hms_product_category_rel[0]?.hms_product_category?.name || 'Uncategorized',
                brand: metadata.brand || '',
                uom: p.hms_uom?.name || p.uom,
                default_cost: Number(metadata.cost_price || p.default_cost || 0),
                mrp: Number(metadata.mrp || p.price || 0)
            };
        });

        return {
            success: true,
            data: serialize(processed),
            meta: { total, page, totalPages: Math.ceil(total / pageSize), currencySymbol: companySettings?.currencies?.symbol || SYSTEM_DEFAULT_CURRENCY_SYMBOL }
        };
    } catch (error) {
        return { error: "Failed to fetch products" };
    }
}

export async function getProduct(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return null;
    try {
        const product = await prisma.hms_product.findUnique({
            where: { id, company_id: session.user.companyId },
            include: {
                hms_product_supplier: { where: { is_primary: true }, take: 1 },
                product_tax_rules: { include: { tax_rates: true }, take: 1, orderBy: { priority: 'asc' } },
                hms_product_image: { take: 1, orderBy: { created_at: 'desc' } },
                hms_product_category_rel: true, hms_stock_levels: true
            }
        });
        if (!product) return null;
        const metadata = product.metadata as Record<string, any> || {};
        return serialize({
            ...product,
            price: Number(product.price || 0),
            mrp: Number(metadata.mrp || product.price || 0),
            hsn: (metadata.hsn as string) || '',
            packing: (metadata.packing as string) || '',
            brand: metadata.brand || '',
            tracking: metadata.tracking || 'none',
            supplierId: product.hms_product_supplier[0]?.supplier_id || '',
            taxRateId: product.product_tax_rules[0]?.tax_rate_id || '',
            taxRate: Number(product.product_tax_rules[0]?.tax_rates?.rate || 0),
            imageUrl: product.hms_product_image[0]?.url || '',
            default_cost: Number(metadata.cost_price || product.default_cost || 0),
            categoryId: product.hms_product_category_rel[0]?.category_id || '',
            manufacturerId: product.manufacturer_id || '',
            stock_levels: product.hms_stock_levels
        });
    } catch (error) { return null; }
}

export async function findOrCreateProduct(productName: string, additionalData?: any) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };
    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;

    try {
        let product = await prisma.hms_product.findFirst({
            where: { company_id: companyId, name: { equals: productName, mode: 'insensitive' } }
        });

        if (product) {
            return { productId: product.id, productName: product.name, created: false };
        }

        const newProduct = await prisma.hms_product.create({
            data: {
                tenant_id: tenantId,
                company_id: companyId,
                name: productName,
                description: productName,
                price: additionalData?.mrp || 0,
                sku: `AUTO-${Date.now()}`,
                is_active: true,
                is_stockable: true,
                metadata: {
                    hsn: additionalData?.hsn,
                    packing: additionalData?.packing,
                    tax_rate: additionalData?.taxRate,
                    autoCreated: true,
                    created_from: 'invoice_scan'
                }
            }
        });

        return { productId: newProduct.id, productName: newProduct.name, created: true };
    } catch (error) { return { error: "Failed to process product" }; }
}

export async function findOrCreateProductsBatch(items: any[]) {
    const results = [];
    for (const item of items) {
        const res = await findOrCreateProduct(item.productName, item);
        results.push({ ...res, originalName: item.productName });
    }
    return { success: true, data: results };
}

export async function getUOMs() {
    const session = await auth();
    if (!session?.user?.companyId) return [];
    try {
        const uoms = await prisma.hms_uom.findMany({
            where: { company_id: session.user.companyId, is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, ratio: true }
        });
        return uoms.map(u => ({ ...u, ratio: Number(u.ratio) }));
    } catch (error) { return []; }
}

export async function findOrCreateUOM(name: string): Promise<string> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return "";
    const cleanName = name.trim().toUpperCase() || "PCS";
    try {
        const existing = await prisma.hms_uom.findFirst({
            where: { company_id: session.user.companyId, name: { equals: cleanName, mode: 'insensitive' } }
        });
        if (existing) return existing.id;

        const catName = `${cleanName} Category`;
        let category = await prisma.hms_uom_category.findFirst({ where: { company_id: session.user.companyId, name: catName } });
        if (!category) {
            category = await prisma.hms_uom_category.create({
                data: { id: crypto.randomUUID(), tenant_id: session.user.tenantId, company_id: session.user.companyId, name: catName }
            });
        }
        const newUom = await prisma.hms_uom.create({
            data: {
                id: crypto.randomUUID(), tenant_id: session.user.tenantId, company_id: session.user.companyId,
                category_id: category.id, name: cleanName, uom_type: 'reference', ratio: 1, is_active: true
            }
        });
        return newUom.id;
    } catch (error) { return ""; }
}

export async function findOrCreateUOMsBatch(names: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const name of names) {
        const id = await findOrCreateUOM(name);
        if (id) results.set(name, id);
    }
    return results;
}

export async function searchProducts(query: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    try {
        const products = await prisma.hms_product.findMany({
            where: { company_id: session.user.companyId, is_active: true, OR: [{ name: { contains: query, mode: 'insensitive' } }, { sku: { contains: query, mode: 'insensitive' } }] },
            select: { id: true, name: true, sku: true, price: true, default_cost: true, uom: true, metadata: true },
            take: 10
        });
        return { success: true, data: products.map(p => ({ ...p, price: Number(p.price || 0), mrp: Number(p.price || 0), default_cost: Number(p.default_cost || (p.metadata as any)?.cost || 0) })) };
    } catch (e: any) { return { error: e.message }; }
}

export async function updateUOM(prevState: any, formData: FormData): Promise<{ error?: string, success?: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    let categoryId = formData.get("categoryId") as string;
    const type = formData.get("type") as string || 'reference';
    const ratio = Number(formData.get("ratio") || 1);
    const baseUnitId = formData.get("baseUnitId") as string;

    if (!id || !name) return { error: "ID and Name are required" };

    try {
        const uomRatio = type === 'reference' ? 1 : ratio;

        let updateData: any = {
            name,
            uom_type: type,
            ratio: new Prisma.Decimal(uomRatio)
        };

        const currentUom = await prisma.hms_uom.findUnique({
            where: { id, company_id: session.user.companyId }
        });

        if (type === 'derived') {
            if (!baseUnitId) return { error: "Base Unit is required for alternative units." };
            const baseUnit = await prisma.hms_uom.findUnique({
                where: { id: baseUnitId, company_id: session.user.companyId }
            });
            if (!baseUnit) return { error: "Selected Base Unit not found." };
            updateData.category_id = baseUnit.category_id;
        } else if (currentUom?.uom_type === 'derived') {
            // Type changed from derived to reference. Needs its own category.
            let catName = `${name} Category`;
            let newCategory = await prisma.hms_uom_category.findFirst({
                where: { company_id: session.user.companyId, name: catName }
            });
            if (!newCategory) {
                newCategory = await prisma.hms_uom_category.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: session.user.tenantId,
                        company_id: session.user.companyId,
                        name: catName
                    }
                });
            }
            updateData.category_id = newCategory.id;
        }

        if (categoryId && !updateData.category_id) {
            updateData.category_id = categoryId;
        }

        await prisma.hms_uom.update({
            where: { id, company_id: session.user.companyId },
            data: updateData
        });
        revalidatePath('/hms/inventory/uom');
        revalidatePath('/hms/inventory/products/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to update UOM:", error);
        return { error: "Failed to update UOM" };
    }
}
