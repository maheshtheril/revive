'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { SYSTEM_DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency"
import { redirect } from "next/navigation"
import crypto from 'crypto';
import { Prisma } from "@prisma/client";
import * as XLSX from 'xlsx';

// --- Dashboard Stats ---

export async function getInventoryDashboardStats() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const companyId = session.user.companyId;

        // 1. Total Products
        const totalProducts = await prisma.hms_product.count({
            where: { company_id: companyId, is_active: true }
        });

        // 2. Low Stock Alerts (Using default threshold of 10)
        const lowStockItems = await prisma.hms_stock_levels.findMany({
            where: {
                company_id: companyId,
            }
        });

        const lowStockCount = lowStockItems.filter(item => {
            const qty = Number(item.quantity || 0);
            const threshold = 10; // Default threshold
            return qty < threshold;
        }).length;

        // 3. Inventory Value (Sum of Stock * Unit Cost)
        // We'll approximate this by summing hms_stock_ledger current value or
        // by summing stock_levels.quantity * product.price (if cost not available)
        // Let's use hms_stock_levels * product.price (assuming price ~ value for now if cost is missing)
        const stockItems = await prisma.hms_stock_levels.findMany({
            where: { company_id: companyId },
            include: {
                hms_product: {
                    select: { price: true } // Using selling price as proxy if cost is null
                }
            }
        });

        let totalValue = 0;
        stockItems.forEach(item => {
            const qty = Number(item.quantity || 0);
            const price = Number(item.hms_product?.price || 0); // fallback to 0
            totalValue += qty * price;
        });

        // 4. Recent Activity (Stock Moves)
        const recentMoves = await prisma.hms_stock_ledger.findMany({
            where: { company_id: companyId },
            take: 5,
            orderBy: { created_at: 'desc' },
            include: {
                hms_product: { select: { name: true, sku: true } }
            }
        });

        return {
            success: true,
            data: {
                totalProducts,
                lowStockCount,
                totalValue,
                recentMoves: recentMoves.map(m => ({
                    id: m.id,
                    product: m.hms_product?.name || 'Unknown',
                    sku: m.hms_product?.sku,
                    type: m.movement_type,
                    qty: Number(m.qty),
                    date: m.created_at
                }))
            }
        };

    } catch (error) {
        console.error("Failed to fetch inventory stats:", error);
        return { error: "Failed to load dashboard data" };
    }
}

// --- Product Management ---


// -- Helpers for Dropdowns --

import fs from 'fs';
import path from 'path';

function logDebug(message: string) {
    try {
        const logPath = path.join(process.cwd(), 'inventory_debug.log');
        fs.appendFileSync(logPath, new Date().toISOString() + ': ' + message + '\n');
    } catch (e) {
        // ignore
    }
}

// -- Helpers for Dropdowns --

export async function getSuppliers() {
    const session = await auth();

    // Debug logging
    logDebug(`getSuppliers: companyId=${session?.user?.companyId}, tenantId=${session?.user?.tenantId}`);

    if (!session?.user?.companyId) return [];

    try {
        let suppliers = await prisma.hms_supplier.findMany({
            where: {
                company_id: session.user.companyId,
                is_active: true
            },
            select: { id: true, name: true }
        });

        if (suppliers.length === 0) {
            logDebug('getSuppliers: Seeding default supplier');
            if (session.user.tenantId) {
                await prisma.hms_supplier.create({
                    data: {
                        tenant_id: session.user.tenantId,
                        company_id: session.user.companyId,
                        name: 'General Vendor',
                        is_active: true
                    }
                });
                suppliers = await prisma.hms_supplier.findMany({
                    where: { company_id: session.user.companyId, is_active: true },
                    select: { id: true, name: true }
                });
            } else {
                logDebug('getSuppliers: Missing tenantId, cannot seed');
            }
        }
        return suppliers;
    } catch (error) {
        logDebug(`getSuppliers Error: ${error}`);
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getTaxRates() {
    const session = await auth();
    logDebug(`getTaxRates: companyId=${session?.user?.companyId}`);

    if (!session?.user?.companyId) return [];

    try {
        const companyId = session.user.companyId;

        // 1. Fetch Company Specific Taxes (Custom Definition)
        const customTaxes = await prisma.company_taxes.findMany({
            where: { company_id: companyId, is_active: true },
            select: { id: true, name: true, rate: true }
        });

        // 2. Fetch Global Mapped Taxes (Map Table)
        const taxMaps = await prisma.company_tax_maps.findMany({
            where: {
                company_id: companyId,
                is_active: true
            },
            include: {
                tax_rates: {
                    select: { id: true, name: true, rate: true }
                }
            }
        });
        const mappedTaxes = taxMaps.map(tm => ({
            id: tm.tax_rates.id,
            name: tm.tax_rates.name,
            rate: Number(tm.tax_rates.rate)
        }));

        // 3. Fetch Accounting Settings Defaults (Company Settings)
        const settings = await prisma.company_accounting_settings.findFirst({
            where: { company_id: companyId },
            include: {
                tax_rates_company_accounting_settings_default_sale_tax_idTotax_rates: true,
                tax_rates_company_accounting_settings_default_purchase_tax_idTotax_rates: true
            }
        });

        const settingTaxes = [];
        if (settings?.tax_rates_company_accounting_settings_default_sale_tax_idTotax_rates) {
            const t = settings.tax_rates_company_accounting_settings_default_sale_tax_idTotax_rates;
            settingTaxes.push({ id: t.id, name: t.name, rate: Number(t.rate) });
        }
        if (settings?.tax_rates_company_accounting_settings_default_purchase_tax_idTotax_rates) {
            const t = settings.tax_rates_company_accounting_settings_default_purchase_tax_idTotax_rates;
            settingTaxes.push({ id: t.id, name: t.name, rate: Number(t.rate) });
        }

        // Combine and Deduplicate
        const allTaxesMap = new Map();
        [...customTaxes.map(t => ({ ...t, rate: Number(t.rate) })), ...mappedTaxes, ...settingTaxes].forEach(t => {
            allTaxesMap.set(t.id, t);
        });

        // 4. Fallback: Fetch Country Default Taxes if auto-load is true or no taxes found
        const compSettings = await prisma.company_settings.findUnique({
            where: { company_id: companyId }
        });

        if (allTaxesMap.size === 0 || compSettings?.auto_load_taxes_from_country !== false) {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
                select: { country_id: true }
            });
            
            const countryTaxesWhere: any = {};
            if (company?.country_id) {
                countryTaxesWhere.country_id = company.country_id;
            }

            const countryTaxes = await prisma.country_tax_mappings.findMany({
                where: countryTaxesWhere,
                include: { tax_rates: true }
            });
            
            countryTaxes.forEach(ct => {
                if (ct.tax_rates && !allTaxesMap.has(ct.tax_rates.id)) {
                    allTaxesMap.set(ct.tax_rates.id, {
                        id: ct.tax_rates.id,
                        name: ct.tax_rates.name,
                        rate: Number(ct.tax_rates.rate)
                    });
                }
            });
        }

        // 5. Final Data-Driven Fallback: If still nothing, seed global rates if empty and try again
        if (allTaxesMap.size === 0) {
            const { ensureGlobalTaxes } = await import("@/lib/services/tax-seed");
            await ensureGlobalTaxes();
            
            const globalTaxes = await prisma.tax_rates.findMany({
                take: 50
            });
            globalTaxes.forEach(t => {
                allTaxesMap.set(t.id, {
                    id: t.id,
                    name: t.name,
                    rate: Number(t.rate)
                });
            });
        }

        let allTaxes = Array.from(allTaxesMap.values());
        return allTaxes;
    } catch (error) {
        logDebug(`getTaxRates Error: ${error}`);
        console.error("Failed to fetch tax rates:", error);
        return [];
    }
}


export async function getUOMs() {
    const session = await auth();
    logDebug(`getUOMs: companyId=${session?.user?.companyId}`);

    if (!session?.user?.companyId || !session?.user?.tenantId) return [];

    try {
        let uoms = await prisma.hms_uom.findMany({
            where: { company_id: session.user.companyId, is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, category_id: true, ratio: true, rounding: true, uom_type: true }
        });

        // Serialization fix: convert Decimals to numbers
        let serializedUoms: any[] = uoms.map(u => ({
            ...u,
            ratio: Number(u.ratio),
            rounding: Number(u.rounding || 0)
        }));

        // --- AUTO-HEAL LEGACY CATEGORIES ---
        // If there are multiple 'reference' units in the same category, extract them into their own categories
        // to comply with Odoo's 1-reference-per-category rule.
        const refUoms = serializedUoms.filter(u => u.uom_type === 'reference');
        const refsByCategory = refUoms.reduce((acc, u) => {
            acc[u.category_id] = acc[u.category_id] || [];
            acc[u.category_id].push(u);
            return acc;
        }, {} as Record<string, any[]>);

        let needsRefetch = false;

        for (const [catId, refsArray] of Object.entries(refsByCategory)) {
            const refs = refsArray as any[];
            if (refs.length > 1) {
                logDebug(`getUOMs: Auto-healing category ${catId}. Found ${refs.length} reference units.`);
                // Keep the first one in the category, move the rest to new categories
                for (let i = 1; i < refs.length; i++) {
                    const refToMove = refs[i];
                    let catName = `${refToMove.name} Category`;
                    
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

                    await prisma.hms_uom.update({
                        where: { id: refToMove.id },
                        data: { category_id: newCategory.id }
                    });
                    needsRefetch = true;
                }
            }
        }

        if (needsRefetch) {
            uoms = await prisma.hms_uom.findMany({
                where: { company_id: session.user.companyId, is_active: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, category_id: true, ratio: true, rounding: true, uom_type: true }
            });
            serializedUoms = uoms.map(u => ({
                ...u,
                ratio: Number(u.ratio),
                rounding: Number(u.rounding || 0)
            }));
        }
        // --- END AUTO-HEAL ---

        return serializedUoms;
    } catch (error) {
        logDebug(`getUOMs Error: ${error}`);
        console.error("Failed to fetch UOMs:", error);
        return [];
    }
}

export async function getUOMCategories() {
    const session = await auth();
    if (!session?.user?.companyId) return [];
    try {
        const categories = await prisma.hms_uom_category.findMany({
            where: { company_id: session.user.companyId },
            include: { hms_uom: true }
        });

        // Serialization fix for Nested UOM records
        const serialized = categories.map(cat => ({
            ...cat,
            hms_uom: cat.hms_uom.map(u => ({
                ...u,
                ratio: Number(u.ratio),
                rounding: Number(u.rounding || 0)
            }))
        }));

        // Removed heavy auto-seeding to prevent Serverless/Vercel timeout.

        return serialized;
    } catch (error) {
        console.error("Failed to fetch UOM categories:", error);
        return [];
    }
}

export async function createUOMCategory(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };
    const name = formData.get("name") as string;
    if (!name) return { error: "Name is required" };
    try {
        await prisma.hms_uom_category.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name
            }
        });
        revalidatePath('/hms/inventory/uom');
        return { success: true };
    } catch (error) {
        return { error: "Failed to create category" };
    }
}

export async function createUOM(prevState: any, formData: FormData): Promise<{ error?: string, success?: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const name = formData.get("name") as string;
    let categoryId = formData.get("categoryId") as string;
    const type = formData.get("type") as string || 'reference';
    const ratio = Number(formData.get("ratio") || 1);
    const baseUnitId = formData.get("baseUnitId") as string;

    if (!name) return { error: "Name is required" };

    try {
        if (type === 'derived') {
            if (!baseUnitId) return { error: "Base Unit is required for alternative units." };
            const baseUnit = await prisma.hms_uom.findUnique({
                where: { id: baseUnitId, company_id: session.user.companyId }
            });
            if (!baseUnit) return { error: "Selected Base Unit not found." };
            categoryId = baseUnit.category_id;
        } else {
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
            categoryId = newCategory.id;
        }

        const uomRatio = type === 'reference' ? 1 : ratio;

        await prisma.hms_uom.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                category_id: categoryId,
                name,
                uom_type: type,
                ratio: new Prisma.Decimal(uomRatio)
            }
        });
        revalidatePath('/hms/inventory/uom');
        revalidatePath('/hms/inventory/products/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to create UOM:", error);
        return { error: "Failed to create UOM: " + (error as Error).message };
    }
}

export async function findOrCreateUOM(name: string): Promise<string> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return "";

    const cleanName = name.trim().toUpperCase() || "PCS";
    
    try {
        // 1. Search existing
        const existing = await prisma.hms_uom.findFirst({
            where: {
                company_id: session.user.companyId,
                name: { equals: cleanName, mode: 'insensitive' }
            }
        });

        if (existing) return existing.id;

        // 2. Create Category if missing
        let catName = `${cleanName} Category`;
        let category = await prisma.hms_uom_category.findFirst({
            where: { company_id: session.user.companyId, name: catName }
        });

        if (!category) {
            category = await prisma.hms_uom_category.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    name: catName
                }
            });
        }

        // 3. Create UOM
        const newUom = await prisma.hms_uom.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                category_id: category.id,
                name: cleanName,
                uom_type: 'reference',
                ratio: 1,
                rounding: 0.01,
                is_active: true
            }
        });

        return newUom.id;
    } catch (error) {
        console.error("findOrCreateUOM Error:", error);
        return "";
    }
}

export async function findOrCreateUOMsBatch(names: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const uniqueNames = Array.from(new Set(names.filter(Boolean).map(n => n.trim().toUpperCase())));
    
    // Process sequentially to avoid race conditions on category creation for now, 
    // or we could optimize with more complex logic. Given the small number of lines, 
    // sequential is safer and usually fast enough for a single scan.
    for (const name of uniqueNames) {
        const id = await findOrCreateUOM(name);
        if (id) results.set(name, id);
    }
    
    return results;
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

export async function deleteUOM(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.hms_uom.update({
            where: { id, company_id: session.user.companyId },
            data: { is_active: false }
        });
        revalidatePath('/hms/inventory/uom');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete UOM:", error);
        return { error: "Failed to delete UOM. It might be in use." };
    }
}

export async function getCategories() {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return [];
    try {
        let categories = await prisma.hms_product_category.findMany({
            where: { company_id: session.user.companyId },
            select: { id: true, name: true, default_tax_rate_id: true, income_account_id: true, expense_account_id: true }
        });

        if (categories.length === 0) {
            await prisma.hms_product_category.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    name: "General"
                }
            });
            categories = await prisma.hms_product_category.findMany({
                where: { company_id: session.user.companyId },
                select: { id: true, name: true, default_tax_rate_id: true, income_account_id: true, expense_account_id: true }
            });
        }
        return categories;
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return [];
    }
}

export async function createCategory(prevState: any, formData: FormData): Promise<{ error: string } | { success: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const name = formData.get("name") as string;
    const taxRateId = formData.get("taxRateId") as string;
    const incomeAccountId = formData.get("incomeAccountId") as string;
    const expenseAccountId = formData.get("expenseAccountId") as string;

    if (!name) return { error: "Name is required" };

    try {
        await prisma.hms_product_category.create({
            data: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name,
                default_tax_rate_id: taxRateId || null,
                income_account_id: incomeAccountId || null,
                expense_account_id: expenseAccountId || null
            }
        });
        revalidatePath('/hms/inventory/categories');
        revalidatePath('/hms/inventory/products/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to create category:", error);
        return { error: "Failed to create category" };
    }
}

export async function updateCategory(prevState: any, formData: FormData): Promise<{ error: string } | { success: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const taxRateId = formData.get("taxRateId") as string;
    const incomeAccountId = formData.get("incomeAccountId") as string;
    const expenseAccountId = formData.get("expenseAccountId") as string;

    if (!id || !name) return { error: "ID and Name are required" };

    try {
        await prisma.hms_product_category.update({
            where: { id, company_id: session.user.companyId },
            data: {
                name,
                default_tax_rate_id: taxRateId || null,
                income_account_id: incomeAccountId || null,
                expense_account_id: expenseAccountId || null
            }
        });
        revalidatePath('/hms/inventory/categories');
        revalidatePath('/hms/inventory/products/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to update category:", error);
        return { error: "Failed to update category" };
    }
}

export async function deleteCategory(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.hms_product_category.delete({
            where: { id, company_id: session.user.companyId }
        });
        revalidatePath('/hms/inventory/categories');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete category:", error);
        return { error: "Failed to delete category" };
    }
}

export async function getManufacturers() {
    const session = await auth();
    if (!session?.user?.companyId) return [];
    try {
        return await prisma.hms_manufacturer.findMany({
            where: { company_id: session.user.companyId, is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true, website: true }
        });
    } catch (error) {
        console.error("Failed to fetch manufacturers:", error);
        return [];
    }
}

export async function createManufacturer(prevState: any, formData: FormData): Promise<{ error: string } | { success: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const name = formData.get("name") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;

    if (!name) return { error: "Name is required" };

    try {
        await prisma.hms_manufacturer.create({
            data: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name,
                website: website || null,
                description: description || null
            }
        });
        revalidatePath('/hms/inventory/manufacturers');
        revalidatePath('/hms/inventory/products/new');
        revalidatePath('/hms/inventory/products/[id]', 'page');
        return { success: true };
    } catch (error) {
        console.error("Failed to create manufacturer:", error);
        return { error: "Failed to create manufacturer: " + (error as Error).message };
    }
}

export async function updateManufacturer(formData: FormData) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;

    if (!id || !name) return { error: "ID and Name are required" };

    try {
        await prisma.hms_manufacturer.update({
            where: { id, company_id: session.user.companyId },
            data: { name, website, description }
        });
        revalidatePath('/hms/inventory/manufacturers');
        revalidatePath('/hms/inventory/products/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to update manufacturer:", error);
        return { error: "Failed to update manufacturer" };
    }
}

export async function deleteManufacturer(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.hms_manufacturer.update({
            where: { id, company_id: session.user.companyId },
            data: { is_active: false }
        });
        revalidatePath('/hms/inventory/manufacturers');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete manufacturer:", error);
        return { error: "Failed to delete manufacturer" };
    }
}



export async function getLocations() {
    const session = await auth();
    if (!session?.user?.companyId) return [];
    try {
        return await prisma.global_stock_location.findMany({
            where: { company_id: session.user.companyId, is_active: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, location_type: true, code: true }
        });
    } catch (error) {
        console.error("Failed to fetch locations:", error);
        return [];
    }
}

export async function createLocation(prevState: any, formData: FormData): Promise<{ error: string } | { success: boolean }> {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const type = formData.get("type") as string || 'internal';

    if (!name) return { error: "Name is required" };

    try {
        await prisma.global_stock_location.create({
            data: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name,
                code,
                location_type: type
            }
        });
        revalidatePath('/hms/inventory/locations');
        return { success: true };
    } catch (error) {
        console.error("Failed to create location:", error);
        return { error: "Failed to create location" };
    }
}

// --- Stock Location Management ---


export async function updateLocation(formData: FormData) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const type = formData.get("type") as string;

    if (!id || !name) return { error: "ID and Name are required" };

    try {
        await prisma.global_stock_location.update({
            where: { id, company_id: session.user.companyId },
            data: { name, code, location_type: type }
        });
        revalidatePath('/hms/inventory/locations');
        return { success: true };
    } catch (error) {
        console.error("Failed to update location:", error);
        return { error: "Failed to update location" };
    }
}

export async function deleteLocation(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        await prisma.global_stock_location.update({
            where: { id, company_id: session.user.companyId },
            data: { is_active: false }
        });
        revalidatePath('/hms/inventory/locations');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete location:", error);
        return { error: "Failed to delete location" };
    }
}

// --- Product Management ---

export async function getProductsPremium(query?: string, page: number = 1, supplierId?: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pageSize = 100;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = {
            company_id: session.user.companyId,
            is_active: true
        };

        // If supplierId is provided, filter products to only those bought from this supplier before
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
            if (uniqueIds.length > 0) {
                where.id = { in: uniqueIds };
            } else {
                // If no items found for this supplier, we don't apply the filter strictly 
                // but we could. User asked to "filter", but if 0 items, search yields 0.
                // Let's stick to the request: filter.
                where.id = "NOT_FOUND"; // Force zero results if strictly filtering and no purchase history
            }
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
                where,
                skip,
                take: pageSize,
                orderBy: { created_at: 'desc' },
                include: {
                    hms_stock_levels: {
                        select: { quantity: true }
                    },
                    hms_product_category_rel: {
                        include: { hms_product_category: true }
                    },
                    hms_uom: true,
                    hms_product_batch: {
                        orderBy: { created_at: 'desc' },
                        take: 1
                    }
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
            let status = 'In Stock';
            if (totalStock === 0) status = 'Out of Stock';
            else if (totalStock < 10) status = 'Low Stock';

            // Memory Asset: Last Batch Price Recall
            const lastBatch = p.hms_product_batch?.[0];
            const metadata = p.metadata as Record<string, any> || {};

            return {
                ...p,
                price: Number(p.price || 0),
                totalStock,
                stockStatus: status,
                category: p.hms_product_category_rel[0]?.hms_product_category?.name || 'Uncategorized',
                brand: metadata.brand || '',
                uom: p.hms_uom?.name || p.uom,
                default_cost: Number(lastBatch?.cost || metadata.cost_price || p.default_cost || 0),
                mrp: Number(lastBatch?.mrp || metadata.mrp || p.price || 0),
                lastSellingPrice: Number(lastBatch?.sale_price || 0)
            };
        });

        // Default to system default if not set
        const currencySymbol = companySettings?.currencies?.symbol || SYSTEM_DEFAULT_CURRENCY_SYMBOL;

        return {
            success: true,
            data: processed,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / pageSize),
                currencySymbol
            }
        };

    } catch (error) {
        console.error("DEBUG: getProductsPremium failed:", error);
        return { error: "Failed to fetch products: " + (error instanceof Error ? error.message : String(error)) };
    }
}

export async function createProduct(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    // Essential Fields
    const name = formData.get("name") as string;
    const sku = formData.get("sku") as string;
    const price = parseFloat(formData.get("price") as string) || 0;
    const type = formData.get("type") as string || 'goods';
    const description = formData.get("description") as string;

    // New Fields
    const brand = formData.get("brand") as string;
    const barcode = formData.get("barcode") as string;
    const uomId = formData.get("uomId") as string;
    const supplierId = formData.get("supplierId") as string;
    const taxRateId = formData.get("taxRateId") as string;
    const categoryId = formData.get("categoryId") as string;
    const tracking = formData.get("tracking") as string || 'none'; // none, batch, serial
    const imageUrl = formData.get("image_url") as string;
    const manufacturerId = formData.get("manufacturerId") as string;

    if (!name || !sku) {
        return { error: "Name and SKU are required" };
    }

    const costPrice = parseFloat(formData.get("costPrice") as string) || 0;
    const mrp = parseFloat(formData.get("mrp") as string) || 0;

    try {
        // Construct Metadata
        const metadata: Record<string, any> = {
            brand: brand || null,
            tracking: tracking, // Store tracking preference
            cost_price: costPrice,
            mrp: mrp
        };

        let uomName = 'each';
        if (uomId) {
            const uomData = await prisma.hms_uom.findUnique({ where: { id: uomId }, select: { name: true } });
            if (uomData) uomName = uomData.name;
        }

        const newProduct = await prisma.hms_product.create({
            data: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                name,
                sku,
                is_stockable: type === 'goods',
                is_service: type === 'service',
                price,
                description,
                uom: uomName,
                uom_id: uomId || null,
                manufacturer_id: manufacturerId || null,
                default_barcode: barcode || null,
                metadata,
                created_by: session.user.id,
                is_active: true
            }
        });

        // Link Supplier if provided
        if (supplierId) {
            await prisma.hms_product_supplier.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: newProduct.id,
                    supplier_id: supplierId,
                    is_primary: true
                }
            });
        }

        // Link Tax Rate if provided
        if (taxRateId) {
            await prisma.product_tax_rules.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: newProduct.id,
                    tax_rate_id: taxRateId,
                    priority: 1
                }
            });
        }

        // Link Image if provided
        if (imageUrl) {
            await prisma.hms_product_image.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: newProduct.id,
                    url: imageUrl,
                    created_by: session.user.id
                }
            });
        }

        // Link Category if provided
        if (categoryId) {
            await prisma.hms_product_category_rel.create({
                data: {
                    product_id: newProduct.id,
                    category_id: categoryId
                }
            });
        }

        revalidatePath('/hms/inventory/products');
        return { success: true };
    } catch (error) {
        console.error("Failed to create product:", error);
        return { error: "Failed to create product" };
    }
}

export async function getProduct(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return null;

    try {
        const product = await prisma.hms_product.findUnique({
            where: {
                id,
                company_id: session.user.companyId
            },
            include: {
                hms_product_supplier: {
                    where: { is_primary: true },
                    take: 1
                },
                product_tax_rules: {
                    include: { tax_rates: true },
                    take: 1,
                    orderBy: { priority: 'asc' }
                },
                hms_product_image: {
                    take: 1,
                    orderBy: { created_at: 'desc' }
                },
                hms_product_category_rel: true,
                hms_stock_levels: true
            }
        });

        if (!product) return null;

        const metadata = product.metadata as Record<string, any> || {};

        return {
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
        };
    } catch (error) {
        console.error("Failed to fetch product:", error);
        return null;
    }
}

export async function updateProduct(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) {
        return { error: "Unauthorized" };
    }

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const sku = formData.get("sku") as string;
    const price = parseFloat(formData.get("price") as string) || 0;
    const description = formData.get("description") as string;

    const brand = formData.get("brand") as string;
    const barcode = formData.get("barcode") as string;
    const uomId = formData.get("uomId") as string;
    const supplierId = formData.get("supplierId") as string;
    const taxRateId = formData.get("taxRateId") as string;
    const categoryId = formData.get("categoryId") as string;
    const tracking = formData.get("tracking") as string || 'none';
    const imageUrl = formData.get("image_url") as string;
    const manufacturerId = formData.get("manufacturerId") as string;

    if (!id || !name || !sku) {
        return { error: "Missing required fields" };
    }

    try {
        const existingProduct = await prisma.hms_product.findUnique({
            where: { id, company_id: session.user.companyId },
            select: { metadata: true }
        });

        const currentMetadata = (existingProduct?.metadata as Record<string, any>) || {};

        const costPrice = parseFloat(formData.get("costPrice") as string) || 0;
        const mrp = parseFloat(formData.get("mrp") as string) || 0;

        const metadata: Record<string, any> = {
            ...currentMetadata,
            brand: brand || null,
            tracking: tracking,
            cost_price: costPrice,
            mrp: mrp
        };

        let uomName = 'each';
        if (uomId) {
            const uomData = await prisma.hms_uom.findUnique({ where: { id: uomId }, select: { name: true } });
            if (uomData) uomName = uomData.name;
        }

        await prisma.hms_product.update({
            where: {
                id,
                company_id: session.user.companyId
            },
            data: {
                name,
                sku,
                price,
                description,
                uom: uomName,
                uom_id: uomId || null,
                manufacturer_id: manufacturerId || null,
                default_barcode: barcode || null,
                metadata,
                updated_by: session.user.id,
                updated_at: new Date()
            }
        });

        // Update Supplier Link
        // First delete existing primary link (simplification)
        await prisma.hms_product_supplier.deleteMany({
            where: { product_id: id, is_primary: true }
        });

        if (supplierId) {
            await prisma.hms_product_supplier.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: id,
                    supplier_id: supplierId,
                    is_primary: true
                }
            });
        }

        // Update Tax Rule
        // Delete existing rule
        await prisma.product_tax_rules.deleteMany({
            where: { product_id: id }
        });

        if (taxRateId) {
            await prisma.product_tax_rules.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: id,
                    tax_rate_id: taxRateId,
                    priority: 1
                }
            });
        }

        // Add New Image if provided
        if (imageUrl) {
            await prisma.hms_product_image.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    product_id: id,
                    url: imageUrl,
                    created_by: session.user.id
                }
            });
        }

        // Update Category
        if (categoryId) {
            await prisma.hms_product_category_rel.deleteMany({
                where: { product_id: id }
            });
            await prisma.hms_product_category_rel.create({
                data: {
                    product_id: id,
                    category_id: categoryId
                }
            });
        }

        revalidatePath('/hms/inventory/products');
        revalidatePath(`/hms/inventory/products/${id}/edit`);
        return { success: true };
    } catch (error) {
        console.error("Failed to update product:", error);
        return { error: "Failed to update product" };
    }
}

export async function getProductBatches(productId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return [];

    try {
        return await prisma.hms_product_batch.findMany({
            where: {
                product_id: productId,
                company_id: session.user.companyId
            },
            orderBy: { expiry_date: 'asc' }
        });
    } catch (error) {
        console.error("Failed to fetch product batches:", error);
        return [];
    }
}

export async function getBestBatch(productId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return null;

    try {
        return await prisma.hms_product_batch.findFirst({
            where: {
                product_id: productId,
                company_id: session.user.companyId,
                qty_on_hand: { gt: 0 }
            },
            orderBy: [
                { expiry_date: 'asc' },
                { created_at: 'asc' }
            ]
        });
    } catch (error) {
        console.error("Failed to fetch best batch:", error);
        return null;
    }
}

export async function updateProductBatch(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const mrp = parseFloat(formData.get("mrp") as string) || 0;
    const expiryDate = formData.get("expiryDate") as string;

    if (!id) return { error: "Batch ID is required" };

    try {
        await prisma.hms_product_batch.update({
            where: { id, company_id: session.user.companyId },
            data: {
                mrp,
                expiry_date: expiryDate ? new Date(expiryDate) : null
            }
        });
        revalidatePath('/hms/inventory/products');
        return { success: true };
    } catch (error) {
        console.error("Failed to update batch:", error);
        return { error: "Failed to update batch" };
    }
}

export async function getSuppliersList(query?: string, page: number = 1) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = {
            company_id: session.user.companyId,
            is_active: true
        };
        if (query) {
            where.name = { contains: query, mode: 'insensitive' };
        }

        const [suppliers, total] = await prisma.$transaction([
            prisma.hms_supplier.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { created_at: 'desc' },
                include: {
                    _count: { select: { hms_product_supplier: true, hms_purchase_order: true } }
                }
            }),
            prisma.hms_supplier.count({ where })
        ]);

        return {
            success: true,
            data: suppliers.map(s => {
                const meta = s.metadata as any || {};
                return {
                    id: s.id,
                    name: s.name,
                    gstin: meta.gstin || '',
                    address: meta.address || '',
                    productCount: s._count.hms_product_supplier,
                    orderCount: s._count.hms_purchase_order,
                    createdAt: s.created_at
                };
            }),
            meta: { total, page, totalPages: Math.ceil(total / pageSize) }
        };
    } catch (error) {
        console.error("Failed to fetch suppliers list:", error);
        return { error: "Failed to fetch suppliers" };
    }
}

export async function getStockMoves(query?: string, page: number = 1, options?: { fromDate?: string, toDate?: string, type?: string }) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = {
            company_id: session.user.companyId
        };

        // Advanced Search (Product Name, SKU, or Reference)
        if (query) {
            where.OR = [
                { reference: { contains: query, mode: 'insensitive' } },
                { hms_product: { name: { contains: query, mode: 'insensitive' } } },
                { hms_product: { sku: { contains: query, mode: 'insensitive' } } }
            ];
        }

        // Date Filtering (Ensuring day boundaries in UTC for the provided dates)
        if (options?.fromDate || options?.toDate) {
            where.created_at = {};
            if (options.fromDate) {
                const from = new Date(options.fromDate);
                from.setUTCHours(0, 0, 0, 0);
                where.created_at.gte = from;
            }
            if (options.toDate) {
                const to = new Date(options.toDate);
                to.setUTCHours(23, 59, 59, 999);
                where.created_at.lte = to;
            }
        }

        // Type Filtering (Mapping frontend uppercase filters to DB values)
        if (options?.type && options.type !== 'ALL') {
            const mappedType = options.type.toUpperCase();
            if (mappedType === 'ADJUSTMENT') {
                where.movement_type = { contains: 'adjustment', mode: 'insensitive' };
            } else if (mappedType === 'IN' || mappedType === 'RECEIPT') {
                // Purchases/Receipts are stored as 'in' or 'RECEIPT' or 'hms_purchase_receipt'
                where.movement_type = { in: ['in', 'RECEIPT', 'hms_purchase_receipt', 'adjustment-in', 'sale_return', 'return'] };
            } else if (mappedType === 'OUT' || mappedType === 'SALE') {
                // Sales/Dispensing are stored as 'out' or 'SALE' or 'hms_invoice'
                where.movement_type = { in: ['out', 'SALE', 'hms_invoice', 'adjustment-out', 'purchase_return'] };
            } else if (mappedType === 'RETURN') {
                where.movement_type = { contains: 'return', mode: 'insensitive' };
            } else {
                where.movement_type = { equals: options.type, mode: 'insensitive' };
            }
        }

        const [moves, total] = await prisma.$transaction([
            prisma.hms_stock_ledger.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { created_at: 'desc' },
                include: {
                    hms_product: { select: { name: true, sku: true, uom: true } }
                }
            }),
            prisma.hms_stock_ledger.count({ where })
        ]);

        return {
            success: true,
            data: moves.map(m => ({
                id: m.id,
                date: m.created_at,
                productName: m.hms_product?.name,
                sku: m.hms_product?.sku,
                type: m.movement_type,
                qty: Number(m.qty),
                uom: m.uom || m.hms_product?.uom,
                reference: m.reference
            })),
            meta: { total, page, totalPages: Math.ceil(total / pageSize) }
        };

    } catch (error) {
        console.error("Failed to fetch stock moves:", error);
        return { error: "Failed to fetch stock moves" };
    }
}

export async function getStockReport(params: { query?: string, page?: number, status?: string } = {}) {
    const { query, page = 1, status: statusFilter, categoryId, manufacturerId } = params as any;
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    try {
        const where: any = {
            company_id: session.user.companyId,
            is_active: true
        };

        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } }
            ];
        }

        if (statusFilter === 'IN_STOCK') {
            where.hms_stock_levels = { some: { quantity: { gt: 0 } } };
        } else if (statusFilter === 'OUT_OF_STOCK') {
            where.hms_stock_levels = { none: { quantity: { gt: 0 } } };
        } else if (statusFilter === 'LOW_STOCK') {
            where.hms_stock_levels = { some: { quantity: { lt: 10, gt: 0 } } };
        }

        if (categoryId && categoryId !== 'ALL') {
            where.hms_product_category_rel = { some: { category_id: categoryId } };
        }

        if (manufacturerId && manufacturerId !== 'ALL') {
            where.manufacturer_id = manufacturerId;
        }

        const [products, total] = await prisma.$transaction([
            prisma.hms_product.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    default_cost: true,
                    uom: true,
                    hms_manufacturer: { select: { name: true } },
                    hms_product_category_rel: {
                        include: { hms_product_category: { select: { name: true } } }
                    }
                },
                take: pageSize,
                skip,
                orderBy: { name: 'asc' }
            }),
            prisma.hms_product.count({ where })
        ]);

        // 2. Fetch Stock Items with Batch Costs
        const allLevels = await prisma.hms_stock_levels.findMany({
            where: { company_id: session.user.companyId },
            include: {
                hms_product: { select: { default_cost: true, price: true } },
                hms_product_batch: { select: { cost: true, sale_price: true } }
            }
        });

        const productValuationMap = new Map<string, { asset: number; saleable: number }>();
        const stockMap = new Map<string, number>();
        let totalAssetValue = 0;   
        let totalSaleableValue = 0; 
        let totalStockOnHand = 0;

        allLevels.forEach(s => {
            const qty = Number(s.quantity || 0);
            const cost = Number(s.hms_product_batch?.cost || s.hms_product?.default_cost || 0);
            const price = Number(s.hms_product_batch?.sale_price || s.hms_product?.price || 0);

            totalStockOnHand += qty;
            totalAssetValue += (qty * cost);
            totalSaleableValue += (qty * price);

            // 2a. Update per-product quantity
            stockMap.set(s.product_id, (stockMap.get(s.product_id) || 0) + qty);

            // 2b. Track per-product valuation for the table rows
            const current = productValuationMap.get(s.product_id) || { asset: 0, saleable: 0 };
            productValuationMap.set(s.product_id, {
                asset: current.asset + (qty * cost),
                saleable: current.saleable + (qty * price)
            });
        });

        const reportData = products.map(p => {
            const stock = stockMap.get(p.id) || 0;
            const valuation = productValuationMap.get(p.id) || { asset: 0, saleable: 0 };
            return {
                id: p.id,
                sku: p.sku || 'N/A',
                name: p.name,
                category: p.hms_product_category_rel[0]?.hms_product_category?.name || 'Uncategorized',
                manufacturer: p.hms_manufacturer?.name || 'N/A',
                uom: p.uom || 'Unit',
                stockOnHand: stock,
                stockValue: valuation.asset,
                status: stock <= 0 ? 'Out of Stock' : (stock < 10 ? 'Low Stock' : 'In Stock')
            };
        });

        return {
            success: true,
            data: reportData,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / pageSize),
                summary: { 
                    totalStockOnHand, 
                    totalAssetValue,
                    totalSaleableValue
                }
            }
        };
    } catch (error: any) {
        console.error("getStockReport Error:", error);
        return { success: false, error: error.message };
    }
}


// --- Smart Product Matching & Auto-Creation ---

export async function findOrCreateProduct(productName: string, additionalData?: {
    mrp?: number;
    hsn?: string;
    packing?: string;
    taxRate?: number;
    uom?: string;
    conversionFactor?: number;
}) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const companyId = session.user.companyId;
        const tenantId = session.user.tenantId;

        // 1. Try to find existing product by exact name match
        let product = await prisma.hms_product.findFirst({
            where: {
                company_id: companyId,
                name: {
                    equals: productName,
                    mode: 'insensitive'
                }
            }
        });

        if (product) {
            // CRITICAL: Even if product exists, ensure it has a Tax Rule if the scan provided one
            if (additionalData?.taxRate) {
                const taxRateVal = Number(additionalData.taxRate);
                if (taxRateVal > 0) {
                    const existingRule = await prisma.product_tax_rules.findFirst({
                        where: { product_id: product.id, is_active: true }
                    });

                    if (!existingRule) {
                        const taxMaps = await prisma.company_tax_maps.findMany({
                            where: { company_id: companyId },
                            include: { tax_rates: true }
                        });
                        const match = taxMaps.find(m => Math.abs(Number(m.tax_rates.rate) - taxRateVal) < 0.1);

                        if (match) {
                            await prisma.product_tax_rules.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    tenant_id: tenantId,
                                    company_id: companyId,
                                    product_id: product.id,
                                    tax_rate_id: match.tax_rate_id,
                                    priority: 1,
                                    is_active: true
                                }
                            });
                            console.log(`✅ UPDATE: Auto-created tax rule for EXISTING product (Exact Match): ${product.name}, Rate: ${taxRateVal}%`);
                        }
                    }
                }
            }

            // Fetch memory assets for AI recall
            const lastBatch = await prisma.hms_product_batch.findFirst({
                where: { product_id: product.id, company_id: companyId },
                orderBy: { created_at: 'desc' }
            });

            return {
                productId: product.id,
                productName: product.name,
                created: false,
                lastSellingPrice: Number(lastBatch?.sale_price || product.price || 0),
                lastMrp: Number(lastBatch?.mrp || (product.metadata as any)?.mrp || product.price || 0)
            };
        }

        // 2. If not found, try fuzzy match
        const similarProducts = await prisma.hms_product.findMany({
            where: {
                company_id: companyId,
                name: {
                    contains: productName,
                    mode: 'insensitive'
                }
            },
            take: 1
        });

        if (similarProducts.length > 0) {
            product = similarProducts[0];

            // CRITICAL: Even if product exists, ensure it has a Tax Rule if the scan provided one
            if (additionalData?.taxRate) {
                const taxRateVal = Number(additionalData.taxRate);
                if (taxRateVal > 0) {
                    const existingRule = await prisma.product_tax_rules.findFirst({
                        where: { product_id: product.id, is_active: true }
                    });

                    if (!existingRule) {
                        const taxMaps = await prisma.company_tax_maps.findMany({
                            where: { company_id: companyId },
                            include: { tax_rates: true }
                        });
                        const match = taxMaps.find(m => Math.abs(Number(m.tax_rates.rate) - taxRateVal) < 0.1);

                        if (match) {
                            await prisma.product_tax_rules.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    tenant_id: tenantId,
                                    company_id: companyId,
                                    product_id: product.id,
                                    tax_rate_id: match.tax_rate_id,
                                    priority: 1,
                                    is_active: true
                                }
                            });
                            console.log(`✅ UPDATE: Auto-created tax rule for EXISTING product: ${product.name}, Rate: ${taxRateVal}%`);
                        }
                    }
                }
            }            // Fetch memory assets for AI recall (Fuzzy Match)
            const lastBatch = await prisma.hms_product_batch.findFirst({
                where: { product_id: product.id, company_id: companyId },
                orderBy: { created_at: 'desc' }
            });

            return {
                productId: product.id,
                productName: product.name,
                created: false,
                fuzzyMatch: true,
                lastSellingPrice: Number(lastBatch?.sale_price || product.price || 0),
                lastMrp: Number(lastBatch?.mrp || (product.metadata as any)?.mrp || product.price || 0)
            };
        }

        // 3. Auto-create new product
        const newProduct = await prisma.hms_product.create({
            data: {
                tenant_id: tenantId,
                company_id: companyId,
                name: productName,
                description: productName, // Use actual name for description
                price: additionalData?.mrp || 0,
                default_cost: 0,
                sku: `AUTO-${Date.now()}`,
                is_active: true,
                is_service: false,
                is_stockable: true,
                metadata: {
                    ...(additionalData?.hsn && { hsn: additionalData.hsn }),
                    ...(additionalData?.packing && { packing: additionalData.packing }),
                    tax_rate: additionalData?.taxRate, // Proactive tax capture
                    uom_data: {
                        purchase_uom: additionalData?.uom || 'PCS',
                        base_uom: 'PCS', // Default base to pieces for pharmacy/retail
                        conversion_factor: additionalData?.conversionFactor || 1
                    },
                    autoCreated: true,
                    created_from: 'invoice_scan',
                    scan_details: additionalData
                }
            }
        });

        // 4. IMMEDIATE TAX RULE CREATION (Critical for Billing)
        if (additionalData?.taxRate) {
            const taxRateVal = Number(additionalData.taxRate);
            if (taxRateVal > 0) {
                // Find matching tax ID in company settings
                const taxMaps = await prisma.company_tax_maps.findMany({
                    where: { company_id: companyId },
                    include: { tax_rates: true }
                });
                const match = taxMaps.find(m => Math.abs(Number(m.tax_rates.rate) - taxRateVal) < 0.1);

                if (match) {
                    await prisma.product_tax_rules.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: newProduct.id,
                            tax_rate_id: match.tax_rate_id,
                            priority: 1,
                            is_active: true
                        }
                    });
                    console.log(`✅ Auto-created tax rule for product: ${productName}, Rate: ${taxRateVal}%`);
                }
            }
        }

        return {
            productId: newProduct.id,
            productName: newProduct.name,
            created: true,
            lastSellingPrice: additionalData?.mrp || 0, // Fallback to MRP for new
            lastMrp: additionalData?.mrp || 0
        };

    } catch (error) {
        console.error("findOrCreateProduct Error:", error);
        return { error: "Failed to resolve product" };
    }
}

export async function findOrCreateProductsBatch(items: { productName: string, mrp?: number, hsn?: string, packing?: string, taxRate?: number, uom?: string, conversion_factor?: number }[]) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    const results: any[] = [];
    const companyId = session.user.companyId;

    // Process sequentially but in a single server call from the UI
    for (const item of items) {
        const res = await findOrCreateProduct(item.productName, item);
        results.push({ ...res, originalName: item.productName });
    }

    return { success: true, data: results };
}

// Helper for CSV Parsing
function parseCSVLine(line: string): string[] {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let val = line.substring(start, i).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            result.push(val.replace(/""/g, '"'));
            start = i + 1;
        }
    }
    let lastVal = line.substring(start).trim();
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.slice(1, -1);
    result.push(lastVal.replace(/""/g, '"'));
    return result;
}

export async function importProductsCSV(formData: FormData) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };
    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;

    const file = formData.get("file") as File;
    const defaultCategory = formData.get("defaultCategory") as string;
    const defaultUom = formData.get("defaultUom") as string || 'UNIT';
    const defaultTaxRate = parseFloat(formData.get("defaultTaxRate") as string) || 0;
    if (!file) return { error: "No file uploaded" };

    let lines: string[] = [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        const text = await file.text();
        lines = text.split(/\r?\n/);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to CSV string then split by lines
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        lines = csvContent.split(/\r?\n/);
    } else {
        return { error: "Unsupported file format. Please upload CSV or Excel (.xlsx, .xls)." };
    }

    if (lines.length < 2) return { error: "Empty or invalid file" };

    // 1. Parse Headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    const getIdx = (patterns: string[]) => headers.findIndex(h => patterns.some(p => h.includes(p)));

    const idxName = getIdx(['name', 'product name', 'item name']);
    const idxSku = getIdx(['sku', 'code', 'item code']);
    const idxBarcode = getIdx(['barcode', 'ean', 'upc']);
    const idxPrice = getIdx(['sale price', 'selling price', 'price', 'rate', 'mrp']);
    const idxMrp = getIdx(['mrp', 'max retail price']);
    const idxPurchase = getIdx(['purchase price', 'cost', 'buy price']);
    const idxTax = getIdx(['tax', 'gst', 'vat']);
    const idxCat = getIdx(['category', 'group', 'type', 'classification']);
    const idxUom = getIdx(['uom', 'unit', 'packing']);
    const idxBrand = getIdx(['brand', 'manufacturer']);
    const idxDesc = getIdx(['description', 'desc', 'details', 'account']);
    const idxStock = getIdx(['stock', 'quantity', 'qty', 'opening']);
    const idxBatch = getIdx(['batch']);
    const idxExpiry = getIdx(['expiry', 'exp']);
    const idxManufacturer = getIdx(['manufacturer', 'mfg']);

    if (idxName === -1) {
        return { error: "CSV must contain a 'Name' column." };
    }

    // 2. Pre-fetch Data for mapping
    const [existingCats, existingTaxes] = await Promise.all([
        prisma.hms_product_category.findMany({ where: { company_id: companyId }, select: { id: true, name: true, default_tax_rate_id: true } }),
        prisma.company_taxes.findMany({ where: { company_id: companyId }, select: { id: true, rate: true } })
    ]);

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 3. Process Rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const row = parseCSVLine(line);

            // Check row length matches roughly or reuse logic
            // Just access safely
            const name = idxName !== -1 ? row[idxName] : null;
            if (!name) continue;

            const sku = idxSku !== -1 && row[idxSku] ? row[idxSku] : `PRD-${name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 30)}`;
            
            // Basic sanitization for SKU
            const sanitizedSku = sku.trim().replace(/[^a-zA-Z0-9-]/g, '');

            const salePrice = idxPrice !== -1 ? parseFloat(row[idxPrice]) || 0 : 0;
            const mrp = idxMrp !== -1 ? parseFloat(row[idxMrp]) || 0 : 0;
            const purchaseCost = idxPurchase !== -1 ? parseFloat(row[idxPurchase]) || 0 : 0;
            const taxRateVal = idxTax !== -1 ? parseFloat(row[idxTax]) : defaultTaxRate;
            const openingStock = idxStock !== -1 ? parseFloat(row[idxStock]) || 0 : 0;
            const uomStr = (idxUom !== -1 && row[idxUom]) ? row[idxUom] : defaultUom;

            // Resolve Category
            let categoryId = null;
            const catNameInput = (idxCat !== -1 && row[idxCat]) ? row[idxCat] : defaultCategory;
            if (catNameInput) {
                const catName = catNameInput;
                const existing = existingCats.find(c => c.name.toLowerCase() === catName.toLowerCase());
                if (existing) categoryId = existing.id;
                else {
                    // Try to find reasonable default accounts for the new category
                    let incomeAccountId = undefined;
                    let expenseAccountId = undefined;

                    if (catName.toLowerCase().includes('pharmacy') || catName.toLowerCase().includes('medicine')) {
                        const phAccount = await prisma.accounts.findFirst({
                            where: { company_id: companyId, code: '4200' } // Pharmacy Sales
                        });
                        if (phAccount) incomeAccountId = phAccount.id;
                    } else if (catName.toLowerCase().includes('consultation') || catName.toLowerCase().includes('op')) {
                        const opAccount = await prisma.accounts.findFirst({
                            where: { company_id: companyId, code: '4020' } // OP Income
                        });
                        if (opAccount) incomeAccountId = opAccount.id;
                    }

                    const newCat = await prisma.hms_product_category.create({
                        data: { 
                            tenant_id: tenantId, 
                            company_id: companyId, 
                            name: catName,
                            income_account_id: incomeAccountId,
                            expense_account_id: expenseAccountId
                        }
                    });
                    existingCats.push(newCat);
                    categoryId = newCat.id;
                }
            }

            // Upsert Product Logic
            const existingProduct = await prisma.hms_product.findFirst({
                where: { company_id: companyId, sku: sanitizedSku }
            });

            let productId: string;
            const metadata: any = {
                brand: idxBrand !== -1 ? row[idxBrand] : undefined,
                manufacturer: idxManufacturer !== -1 ? row[idxManufacturer] : undefined,
                mrp: mrp > 0 ? mrp : undefined,
                purchase_price: purchaseCost > 0 ? purchaseCost : undefined
            };

            if (existingProduct) {
                // Update
                const updated = await prisma.hms_product.update({
                    where: { id: existingProduct.id },
                    data: {
                        name,
                        price: salePrice > 0 ? salePrice : existingProduct.price,
                        description: idxDesc !== -1 && row[idxDesc] ? row[idxDesc] : existingProduct.description,
                        metadata: { ...(existingProduct.metadata as object), ...metadata }
                    }
                });
                productId = updated.id;
                updatedCount++;
            } else {
                // Create
                const created = await prisma.hms_product.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        name,
                        sku: sanitizedSku,
                        price: salePrice,
                        description: idxDesc !== -1 ? row[idxDesc] : '',
                        uom: uomStr,
                        is_active: true,
                        is_stockable: true,
                        is_service: false,
                        created_by: session.user.id,
                        default_barcode: idxBarcode !== -1 ? row[idxBarcode] : null,
                        metadata
                    }
                });
                productId = created.id;
                createdCount++;

            }

            // Always Link Category if provided (for both New and Existing)
            if (categoryId) {
                await prisma.hms_product_category_rel.upsert({
                    where: { 
                        product_id_category_id: {
                            product_id: productId,
                            category_id: categoryId
                        }
                    },
                    update: {},
                    create: {
                        product_id: productId,
                        category_id: categoryId
                    }
                });
            }

            // 4. Handle Tax Rule
            let taxRateToApply = taxRateVal;
            let taxRateIdToApply = null;

            // If no specific tax rate in CSV, try Category default
            if (idxTax === -1 || isNaN(parseFloat(row[idxTax]))) {
                const cat = existingCats.find(c => c.id === categoryId);
                if (cat?.default_tax_rate_id) {
                    taxRateIdToApply = cat.default_tax_rate_id;
                }
            }

            if (taxRateIdToApply) {
                 const existingRule = await prisma.product_tax_rules.findFirst({
                    where: { product_id: productId }
                });
                if (!existingRule) {
                    await prisma.product_tax_rules.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId,
                            tax_rate_id: taxRateIdToApply,
                            priority: 1
                        }
                    });
                }
            } else if (!isNaN(taxRateToApply)) {
                const match = existingTaxes.find(t => Math.abs(Number(t.rate) - taxRateToApply) < 0.1);
                if (match) {
                    const existingRule = await prisma.product_tax_rules.findFirst({
                        where: { product_id: productId }
                    });
                    if (!existingRule) {
                        await prisma.product_tax_rules.create({
                            data: {
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: productId,
                                tax_rate_id: match.id,
                                priority: 1
                            }
                        });
                    }
                }
            }

            // 5. Handle Opening Stock
            if (openingStock > 0) {
                // Handle Batch
                let batchId: string | null = null;
                if (idxBatch !== -1 && row[idxBatch]) {
                    const batchNo = row[idxBatch];
                    const expiry = idxExpiry !== -1 && row[idxExpiry] ? new Date(row[idxExpiry]) : null;


                    // Upsert Batch
                    const batch = await prisma.hms_product_batch.upsert({
                        where: {
                            tenant_id_company_id_product_id_batch_no: {
                                tenant_id: tenantId,
                                company_id: companyId,
                                product_id: productId,
                                batch_no: batchNo
                            }
                        },
                        create: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId,
                            batch_no: batchNo,
                            expiry_date: expiry,
                            qty_on_hand: openingStock
                        },
                        update: {
                            qty_on_hand: { increment: openingStock }
                        }
                    });
                    batchId = batch.id;
                }

                // Get Last Balance from ledger
                let currentBalance = 0;
                const lastLedger = await prisma.hms_product_stock_ledger.findFirst({
                    where: { product_id: productId, company_id: companyId },
                    orderBy: { created_at: 'desc' }
                });
                if (lastLedger) currentBalance = Number(lastLedger.balance_qty);

                const newBalance = currentBalance + openingStock;

                // Create Ledger Entry
                await prisma.hms_product_stock_ledger.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: productId,
                        movement_type: 'OPENING',
                        change_qty: openingStock,
                        balance_qty: newBalance,
                        batch_id: batchId,
                        reference: `IMPORT-${Date.now()}-${i}`,
                        cost: purchaseCost > 0 ? purchaseCost : undefined
                    }
                });
            }
        } catch (e) {
            const msg = (e as Error).message;
            errors.push({ row: i + 1, error: msg });
        }
    }

    revalidatePath('/hms/inventory/products');
    return { 
        success: true, 
        message: `Import complete. ${createdCount} new products added, ${updatedCount} existing products updated.`,
        created: createdCount,
        updated: updatedCount,
        errors 
    };
}

export async function getBatchHistory(batchId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return [];
    try {
        return await prisma.hms_stock_ledger.findMany({
            where: { batch_id: batchId, company_id: session.user.companyId },
            orderBy: { created_at: 'desc' }
        });
    } catch (error) {
        console.error("Failed to fetch batch history:", error);
        return [];
    }
}

export async function adjustStock(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { error: "Unauthorized" };

    const batchId = formData.get("batchId") as string;
    const multiplier = parseFloat(formData.get("multiplier") as string) || 1;
    const changeQty = (parseFloat(formData.get("changeQty") as string) || 0) * multiplier;
    const reason = formData.get("reason") as string || "Manual Adjustment";

    if (!batchId || changeQty === 0) return { error: "Invalid data" };

    try {
        await prisma.$transaction(async (tx) => {
            const batch = await tx.hms_product_batch.findUnique({
                where: { id: batchId, company_id: session.user.companyId }
            });
            if (!batch) throw new Error("Batch not found");

            let warehouse = await tx.hms_stock_location.findFirst({
                where: { company_id: session.user.companyId, name: 'Main Warehouse' }
            }) || await tx.hms_stock_location.findFirst({
                where: { company_id: session.user.companyId }
            });

            if (!warehouse) throw new Error("No stock location found");

            await tx.hms_product_batch.update({
                where: { id: batchId },
                data: { qty_on_hand: { increment: changeQty } }
            });

            const stockLevelWhere = {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                product_id: batch.product_id,
                location_id: warehouse.id,
                batch_id: batchId
            };

            const existingLevel = await tx.hms_stock_levels.findFirst({ where: stockLevelWhere as any });

            if (existingLevel) {
                await tx.hms_stock_levels.update({
                    where: { id: existingLevel.id },
                    data: { quantity: { increment: changeQty }, updated_at: new Date() }
                });
            } else {
                await tx.hms_stock_levels.create({
                    data: {
                        tenant_id: session.user.tenantId as string,
                        company_id: session.user.companyId as string,
                        product_id: batch.product_id,
                        location_id: warehouse.id,
                        batch_id: batchId,
                        quantity: changeQty,
                        reserved: 0
                    }
                });
            }

            // Standardize: Adjustments should be logged in hms_stock_ledger (signed sums)
            await tx.hms_stock_ledger.create({
                data: {
                    tenant_id: session.user.tenantId as string,
                    company_id: session.user.companyId as string,
                    product_id: batch.product_id,
                    movement_type: changeQty > 0 ? 'adjustment-in' : 'adjustment-out',
                    qty: changeQty, // Store SIGNED value for World Standard reconciliation
                    batch_id: batchId,
                    reference: reason,
                    to_location_id: changeQty > 0 ? warehouse.id : null,
                    from_location_id: changeQty < 0 ? warehouse.id : null
                }
            });
        });

        revalidatePath('/hms/inventory/products');
        return { success: true };
    } catch (error) {
        console.error("Adjustment failed:", error);
        return { error: "Failed to process adjustment" };
    }
}

export async function searchProducts(query: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const products = await prisma.hms_product.findMany({
            where: {
                company_id: session.user.companyId,
                is_active: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: { id: true, name: true, sku: true, price: true, uom: true, metadata: true },
            take: 10
        });

        return {
            success: true,
            data: products.map(p => {
                const metadata = p.metadata as any || {};
                const uomData = metadata.uom_data || {};
                return {
                    ...p,
                    mrp: Number(p.price || 0),
                    // Flatten key UOM fields for the UI
                    purchase_uom: metadata.purchase_uom || uomData.purchase_uom || metadata.pack_uom || uomData.pack_uom || '',
                    base_uom: metadata.base_uom || uomData.base_uom || '',
                    default_cost: metadata.cost || uomData.cost || 0
                };
            })
        };
    } catch (e: any) {
        return { error: e.message };
    }
}


export async function recalculateStockLevels() {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };
    const { companyId, tenantId } = session.user as any;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Wipe the cache. This is the only way to kill ghost entries (the "367" bug).
            await tx.hms_stock_levels.deleteMany({
                where: { company_id: companyId }
            });

            // 2. Locate the Primary Storage
            const location = await tx.hms_stock_location.findFirst({
                where: { company_id: companyId, is_active: true }
            });
            if (!location) throw new Error("No active stock location found for reconciliation.");

            // 3. Aggregate Pure Truth from Ledger
            // We group by product AND batch to keep inventory granular
            const ledgerAggregates = await tx.hms_stock_ledger.groupBy({
                by: ['product_id', 'batch_id'],
                where: { company_id: companyId },
                _sum: { qty: true }
            });

            // 4. Batch Restore the Stock Levels
            if (ledgerAggregates.length > 0) {
                await tx.hms_stock_levels.createMany({
                    data: ledgerAggregates.map(agg => ({
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: agg.product_id,
                        location_id: location.id, // Re-map to primary location for now
                        batch_id: agg.batch_id,
                        quantity: Number(agg._sum.qty || 0),
                        reserved: 0
                    }))
                });
            }

            // 5. Heal Product Costs (Landed Cost Recovery)
            const products = await tx.hms_product.findMany({
                where: { company_id: companyId },
                select: { id: true }
            });

            for (const p of products) {
                const lastPurchaseLine = await tx.hms_stock_ledger.findFirst({
                    where: { 
                        product_id: p.id, 
                        company_id: companyId, 
                        movement_type: 'in',
                        unit_cost: { gt: 0 }
                    },
                    orderBy: { created_at: 'desc' },
                    select: { unit_cost: true }
                });

                if (lastPurchaseLine?.unit_cost) {
                    await tx.hms_product.update({
                        where: { id: p.id },
                        data: { default_cost: lastPurchaseLine.unit_cost }
                    });
                }
            }
        }, { timeout: 30000 }); // Larger timeout for full reconciliation

        revalidatePath('/hms/inventory/reports/stock');
        return { success: true, message: "Inventory re-synchronized successfully. All ghost entries purged." };
    } catch (e: any) {
        console.error("Recalculate Error:", e);
        return { success: false, error: e.message };
    }
}
