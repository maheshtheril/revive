'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import * as inventorySearch from "./inventory-search";
import { SYSTEM_DEFAULT_CURRENCY_SYMBOL } from "@/lib/currency"
import { redirect } from "next/navigation"
import crypto from 'crypto';
import { Prisma } from "@prisma/client";
import * as XLSX from 'xlsx';
import { serialize } from "@/lib/utils"

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
        // [WORLD CLASS] Multi-layered valuation: Use batch cost first, fallback to derived unit price
        const batches = await prisma.hms_product_batch.findMany({
            where: { company_id: companyId, qty_on_hand: { gt: 0 } },
            select: { qty_on_hand: true, cost: true, mrp: true }
        });

        let totalValue = 0;
        batches.forEach(b => {
            const qty = Number(b.qty_on_hand || 0);
            const cost = Number(b.cost || b.mrp || 0); // Using cost or mrp fallback
            totalValue += qty * cost;
        });

        // If no batches found (perhaps old stock system), fallback to stock_levels
        if (totalValue === 0) {
            const stockItems = await prisma.hms_stock_levels.findMany({
                where: { company_id: companyId },
                include: { hms_product: { select: { price: true, metadata: true } } }
            });

            stockItems.forEach(item => {
                const qty = Number(item.quantity || 0);
                const metadata = (item.hms_product?.metadata || {}) as any;
                const packingQty = Number(metadata.packingQty) || 1;
                const fullPrice = Number(item.hms_product?.price || 0);
                const unitPrice = packingQty > 1 ? (fullPrice / packingQty) : fullPrice;
                totalValue += qty * unitPrice;
            });
        }

        // 4. Recent Activity (Stock Moves)
        const recentMovesRes = await prisma.hms_stock_ledger.findMany({
            where: { company_id: companyId },
            take: 5,
            orderBy: { created_at: 'desc' },
            include: {
                hms_product: { select: { name: true, sku: true, metadata: true } }
            }
        });

        const { formatFriendlyQty } = await import("@/lib/utils/inventory-formatter");

        return {
            success: true,
            data: {
                totalProducts,
                lowStockCount,
                totalValue,
                recentMoves: recentMovesRes.map(m => ({
                    id: m.id,
                    product: m.hms_product?.name || 'Unknown',
                    sku: m.hms_product?.sku,
                    type: m.movement_type,
                    qty: Number(m.qty),
                    friendlyQty: formatFriendlyQty(Math.abs(Number(m.qty)), m.hms_product?.metadata),
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

// Wrapped Search Actions to comply with "use server" export standards
export async function findOrCreateUOM(name: string) { return await inventorySearch.findOrCreateUOM(name); }
export async function findOrCreateUOMsBatch(names: string[]) { return await inventorySearch.findOrCreateUOMsBatch(names); }
export async function updateUOM(prevState: any, formData: FormData) { return await inventorySearch.updateUOM(prevState, formData); }

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
    return await inventorySearch.getProductsPremium(query, page, supplierId);
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
        return { success: true, productId: newProduct.id, name: newProduct.name };
    } catch (error) {
        console.error("Failed to create product:", error);
        return { error: "Failed to create product" };
    }
}

export async function getProduct(id: string) { return await inventorySearch.getProduct(id); }

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
        const batches = await prisma.hms_product_batch.findMany({
            where: {
                product_id: productId,
                company_id: session.user.companyId
            },
            orderBy: { expiry_date: 'asc' }
        });
        return serialize(batches);
    } catch (error) {
        console.error("Failed to fetch product batches:", error);
        return [];
    }
}

export async function getBestBatch(productId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return null;

    try {
        const batch = await prisma.hms_product_batch.findFirst({
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

        if (!batch) return null;

        // Serialization fix: Convert all Decimals and complex types for Client Component safety
        return serialize(batch);
    } catch (error) {
        console.error("Failed to fetch best batch:", error);
        return null;
    }
}

export async function deleteProduct(productId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    if (!companyId) return { error: "Unauthorized" };
    
    try {
        // [SERIOUS-AUTH-VALIDATION]
        const user = session.user as any;
        console.log(`[DELETE-PRODUCT] User: ${user.email}, Role: ${user.role}, Admin: ${user.isAdmin}, TenantAdmin: ${user.isTenantAdmin}`);
        
        const hasPermission = 
            user.isAdmin === true || 
            user.isTenantAdmin === true || 
            user.isPlatformAdmin === true || 
            user.role?.toLowerCase() === 'admin';
        
        if (!hasPermission) {
            return { error: "Access Denied: You do not have the administrative clearance required to delete master records." };
        }

        // [SERIOUS-INTEGRITY-CHECK] 
        const [invoiceLines, poLines, ledger, stock, medication, prescriptions] = await Promise.all([
            prisma.hms_invoice_lines.count({ where: { product_id: productId } }),
            prisma.hms_purchase_order_line.count({ where: { product_id: productId } }),
            prisma.hms_stock_ledger.count({ where: { product_id: productId } }),
            prisma.hms_stock_levels.findMany({ where: { product_id: productId, quantity: { gt: 0 } } }),
            prisma.hms_medication_order.count({ where: { drug_id: productId } }),
            prisma.prescription_items.count({ where: { medicine_id: productId } })
        ]);

        if (invoiceLines > 0) return { error: `Audit Lock: This product is linked to ${invoiceLines} billing transactions.` };
        if (poLines > 0) return { error: `Audit Lock: This product has ${poLines} purchase records.` };
        if (ledger > 0) return { error: `Audit Lock: This product has historical movements in the stock ledger.` };
        if (stock.length > 0) {
            const total = stock.reduce((sum, s) => sum + Number(s.quantity), 0);
            return { error: `Inventory Lock: Current physical stock is ${total}. Adjust to zero first.` };
        }
        if (medication > 0) return { error: `Clinical Lock: Linked to medication orders.` };
        if (prescriptions > 0) return { error: `Clinical Lock: Linked to patient prescriptions.` };

        // [WORLD-STANDARD-CLEANUP]
        await prisma.$transaction(async (tx) => {
            await tx.hms_product_category_rel.deleteMany({ where: { product_id: productId } });
            await tx.hms_product_supplier.deleteMany({ where: { product_id: productId } });
            await tx.product_tax_rules.deleteMany({ where: { product_id: productId } });
            await tx.hms_product_image.deleteMany({ where: { product_id: productId } });
            await tx.hms_product_price_history.deleteMany({ where: { product_id: productId } });
            await tx.hms_stock_levels.deleteMany({ where: { product_id: productId } });
            await tx.hms_product_batch.deleteMany({ where: { product_id: productId } });
            await tx.hms_product.delete({ where: { id: productId, company_id: companyId } });
        });

        revalidatePath('/hms/inventory/products');
        return { success: true };
    } catch (error: any) {
        console.error("[CRITICAL-DELETE-FAILURE] Product ID:", productId, "Error:", error);
        return { error: `System Error: ${error.message || "Unknown database failure"}` };
    }
}



export async function updateProductBatch(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { error: "Unauthorized" };

    const id = formData.get("id") as string;
    const mrp = parseFloat(formData.get("mrp") as string) || 0;
    const cost = parseFloat(formData.get("cost") as string);
    const salePrice = parseFloat(formData.get("salePrice") as string);
    const expiryDate = formData.get("expiryDate") as string;

    if (!id) return { error: "Batch ID is required" };

    try {
        await prisma.hms_product_batch.update({
            where: { id, company_id: session.user.companyId },
            data: {
                mrp,
                cost: isNaN(cost) ? undefined : cost,
                sale_price: isNaN(salePrice) ? undefined : salePrice,
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
    return await inventorySearch.getSuppliersList(query, page);
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
                if (!isNaN(from.getTime())) {
                    from.setUTCHours(0, 0, 0, 0);
                    where.created_at.gte = from;
                }
            }
            if (options.toDate) {
                const to = new Date(options.toDate);
                if (!isNaN(to.getTime())) {
                    to.setUTCHours(23, 59, 59, 999);
                    where.created_at.lte = to;
                }
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
                    hms_product: { 
                        select: { 
                            name: true, 
                            sku: true, 
                            uom: true,
                            hms_stock_levels: {
                                select: { quantity: true }
                            }
                        } 
                    }
                }
            }),
            prisma.hms_stock_ledger.count({ where })
        ]);

        const productSummary = query ? await prisma.hms_product.findFirst({
            where: {
                company_id: session.user.companyId,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: {
                hms_stock_levels: { select: { quantity: true } }
            }
        }) : null;

        let summary = null;
        if (productSummary) {
            const currentStock = productSummary.hms_stock_levels.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
            summary = {
                name: productSummary.name,
                sku: productSummary.sku,
                uom: productSummary.uom,
                currentStock
            };
        }

        return serialize({
            success: true,
            data: moves.map(m => ({
                id: m.id,
                date: m.created_at,
                productName: m.hms_product?.name || 'Unknown Product',
                sku: m.hms_product?.sku || 'N/A',
                type: m.movement_type,
                qty: Number(m.qty),
                uom: m.uom || (m.hms_product as any)?.uom || 'Unit',
                reference: m.reference
            })),
            meta: { total, page, totalPages: Math.ceil(total / pageSize) },
            productSummary: summary
        });

    } catch (error) {
        console.error("Failed to fetch stock moves:", error);
        return { error: "Failed to fetch stock moves" };
    }
}

export async function getStockReport(options: {
    query?: string;
    page?: number;
    limit?: number;
    category?: string;
    status?: 'all' | 'low' | 'out' | 'expiry' | 'in' | 'negative';
    sortBy?: 'name' | 'qty' | 'value' | 'expiry';
    sortOrder?: 'asc' | 'desc';
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!companyId || !tenantId) return { error: "Session expired. Please re-login." };

    const page = options.page || 1;
    const limit = options.limit || 50;

    try {
        const productWhere: any = {
            company_id: companyId,
            is_active: true,
            // [MOD] Removed strict is_stockable: true to show all products that might have physical batches/stock
        };

        if (options.query) {
            productWhere.OR = [
                { name: { contains: options.query, mode: 'insensitive' } },
                { sku: { contains: options.query, mode: 'insensitive' } },
                { hms_product_batch: { some: { company_id: companyId, batch_no: { contains: options.query, mode: 'insensitive' } } } }
            ];
        }

        if (options.category) {
            productWhere.hms_product_category_rel = {
                some: { category_id: options.category }
            };
        }

        // --- Server-Side Status Constraints ---
        if (options.status && options.status !== 'all') {
            if (options.status === 'in') {
                productWhere.hms_product_batch = { some: { company_id: companyId, qty_on_hand: { gt: 0 } } };
            } else if (options.status === 'out') {
                productWhere.hms_product_batch = {
                    OR: [
                        { every: { company_id: companyId, qty_on_hand: { lte: 0 } } },
                        { none: { company_id: companyId } }
                    ]
                };
            } else if (options.status === 'low') {
                productWhere.hms_product_batch = { some: { company_id: companyId, qty_on_hand: { gt: 0, lt: 10 } } };
            } else if (options.status === 'expiry') {
                const threeMonths = new Date();
                threeMonths.setMonth(threeMonths.getMonth() + 3);
                productWhere.hms_product_batch = { some: { company_id: companyId, expiry_date: { lte: threeMonths, gt: new Date() } } };
            } else if (options.status === 'negative') {
                productWhere.hms_product_batch = { some: { company_id: companyId, qty_on_hand: { lt: 0 } } };
            }
        }

        const [products, total] = await Promise.all([
            prisma.hms_product.findMany({
                where: productWhere,
                include: {
                    hms_uom: true,
                    hms_product_category_rel: {
                        include: { hms_product_category: true }
                    },
                    hms_product_batch: {
                        where: {
                            company_id: companyId,
                            // If filtering 'in', only show batches with stock in the result
                            ...(options.status === 'in' ? { qty_on_hand: { gt: 0 } } : {})
                        },
                        orderBy: { expiry_date: 'asc' }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.hms_product.count({ where: productWhere })
        ]);

        const { formatFriendlyQty } = await import("@/lib/utils/inventory-formatter");

        const reportData: any[] = [];
        products.forEach(p => {
            const categoryName = p.hms_product_category_rel[0]?.hms_product_category?.name || 'General';
            const uomName = (p as any).hms_uom?.name || 'Unit';
            const batches = p.hms_product_batch;

            if (batches.length === 0) {
                // Only show 0-stock products if we are looking at 'All' or 'Out of Stock'
                if (options.status === 'all' || options.status === 'out') {
                    reportData.push({
                        id: `p-${p.id}`,
                        productId: p.id,
                        sku: p.sku || 'N/A',
                        name: p.name,
                        batchNo: 'N/A',
                        expiryDate: null,
                        qty: 0,
                        uom: uomName,
                        friendlyQty: '0 Units',
                        costPrice: p.default_cost?.toNumber() || 0,
                        mrp: Number((p.metadata as any)?.last_mrp || 0),
                        salePrice: p.price?.toNumber() || 0,
                        totalValue: 0,
                        category: categoryName,
                        status: 'Out of Stock',
                        metadata: p.metadata
                    });
                }
            } else {
                batches.forEach(b => {
                    const costVal = b.cost?.toNumber() || 0;
                    const qtyVal = b.qty_on_hand?.toNumber() || 0;
                    const mrpVal = b.mrp?.toNumber() || 0;
                    const saleVal = b.sale_price?.toNumber() || 0;

                    reportData.push({
                        id: b.id,
                        productId: p.id,
                        sku: p.sku,
                        name: p.name,
                        batchNo: b.batch_no,
                        expiryDate: b.expiry_date,
                        qty: qtyVal,
                        friendlyQty: formatFriendlyQty(qtyVal, p.metadata),
                        uom: uomName,
                        costPrice: costVal,
                        mrp: mrpVal,
                        salePrice: saleVal,
                        totalValue: costVal * qtyVal,
                        category: categoryName,
                        status: qtyVal < 0 ? 'Negative Stock' : (qtyVal === 0 ? 'Out of Stock' : (qtyVal < 10 ? 'Low Stock' : 'In Stock')),
                        metadata: p.metadata
                    });
                });
            }
        });

        // Global Valuation calculation (across the ENTIRE company, regardless of paging)
        // We calculate this using a raw query or sum aggregation for accuracy
        // [MOD] Optimized: Use the same tenant/active filters for summary consistency
        const allBatches = await prisma.hms_product_batch.findMany({
            where: {
                company_id: companyId,
                hms_product: { is_active: true }
            },
            select: { qty_on_hand: true, cost: true, expiry_date: true }
        });

        const now = new Date();
        const threeMonths = new Date();
        threeMonths.setMonth(now.getMonth() + 3);

        const summary = allBatches.reduce((acc, curr) => {
            const qty = curr.qty_on_hand.toNumber();
            const costValue = qty * (curr.cost?.toNumber() || 0);

            acc.totalValue += costValue;
            acc.totalQty += qty;

            if (curr.expiry_date && curr.expiry_date <= threeMonths && curr.expiry_date > now) {
                acc.expiringCount++;
            }

            if (qty <= 0 || qty < 10) {
                acc.criticalCount++;
            }

            return acc;
        }, { totalValue: 0, totalQty: 0, expiringCount: 0, criticalCount: 0 });

        return {
            success: true,
            data: serialize(reportData),
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                globalSummary: summary
            }
        };
    } catch (err: any) {
        console.error("Stock Report Error:", err);
        return { success: false, error: err.message };
    }
}

export async function exportStockReportToExcel() {
    const reportData: any = await getStockReport({ limit: 1000, status: 'all' });
    if (!reportData.success || !reportData.data) return { error: "Failed to generate report" };

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(reportData.data.map((item: any) => ({
        'Category': item.category,
        'SKU': item.sku,
        'Product Name': item.productName,
        'Batch No': item.batchNo,
        'Expiry Date': item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A',
        'Quantity': item.qty,
        'UOM': item.uom,
        'Packing (Friendly)': item.friendlyQty,
        'Cost Price': item.costPrice,
        'MRP': item.mrp,
        'Sale Price': item.salePrice,
        'Stock Value': item.totalValue
    })));

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return { success: true, base64: buffer.toString('base64'), filename: `Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx` };
}

export async function bulkUpdateBatchPricing(updates: { batchId: string, cost?: number, mrp?: number, salePrice?: number }[]) {
    const session = await auth();
    if (!session?.user?.id || !session.user.companyId) return { error: "Unauthorized" };

    try {
        await prisma.$transaction(
            updates.map(u => prisma.hms_product_batch.update({
                where: { id: u.batchId, company_id: session.user.companyId },
                data: {
                    ...(u.cost !== undefined && { cost: new Prisma.Decimal(u.cost) }),
                    ...(u.mrp !== undefined && { mrp: new Prisma.Decimal(u.mrp) }),
                    ...(u.salePrice !== undefined && { sale_price: new Prisma.Decimal(u.salePrice) })
                }
            }))
        );
        revalidatePath('/hms/inventory/reports/stock');
        return { success: true };
    } catch (err: any) {
        return { error: err.message };
    }
}

// --- Smart Product Matching & Auto-Creation ---

export async function findOrCreateProduct(productName: string, additionalData?: any) {
    return await inventorySearch.findOrCreateProduct(productName, additionalData);
}
export async function findOrCreateProductsBatch(items: any[]) {
    return await inventorySearch.findOrCreateProductsBatch(items);
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
    const idxManufacturer = getIdx(['manufacturer', 'mfg', 'brand', 'company']);
    const idxGeneric = getIdx(['generic', 'salt', 'composition', 'molecule']);
    const idxHsn = getIdx(['hsn', 'sac', 'tax code', 'hsn_code']);
    const idxMinStock = getIdx(['min stock', 'alert level', 'reorder']);
    const idxProductType = getIdx(['type', 'kind', 'class']);

    if (idxName === -1) {
        return { error: "CSV must contain a 'Name' column." };
    }

    // 2. Pre-fetch Data for mapping (Optimization: Fetch all at once to avoid thousands of per-row queries)
    const [existingCats, existingTaxes, existingManufacturers, existingProducts, defaultLocation] = await Promise.all([
        prisma.hms_product_category.findMany({ where: { company_id: companyId }, select: { id: true, name: true, default_tax_rate_id: true } }),
        prisma.company_taxes.findMany({ where: { company_id: companyId }, select: { id: true, rate: true } }),
        prisma.hms_manufacturer.findMany({ where: { company_id: companyId }, select: { id: true, name: true } }),
        prisma.hms_product.findMany({ where: { company_id: companyId }, select: { id: true, sku: true, price: true, description: true, manufacturer_id: true, metadata: true } }),
        prisma.hms_stock_location.findFirst({ where: { company_id: companyId } })
    ]);

    // Resolved Default Location (fallback if missing)
    let locationId = defaultLocation?.id;
    if (!locationId) {
        const newLocation = await prisma.hms_stock_location.create({
            data: {
                tenant_id: tenantId,
                company_id: companyId,
                name: 'Main Store',
                code: 'MAIN'
            }
        });
        locationId = newLocation.id;
    }

    // Maps for fast lookups
    const productMap = new Map(existingProducts.map(p => [p.sku, p]));
    const catMap = new Map(existingCats.map(c => [c.name.toLowerCase(), c]));
    const mfgMap = new Map(existingManufacturers.map(m => [m.name.toLowerCase(), m]));
    const taxMap = existingTaxes.map(t => ({ id: t.id, rate: Number(t.rate) }));

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 3. Process Rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const row = parseCSVLine(line);
            const name = idxName !== -1 ? row[idxName] : null;
            if (!name) continue;

            const sku = idxSku !== -1 && row[idxSku] ? row[idxSku] : `PRD-${name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 30)}`;
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
                const catName = catNameInput.trim();
                let cat = catMap.get(catName.toLowerCase());
                if (!cat) {
                    // Create once and update map
                    cat = await prisma.hms_product_category.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: catName,
                        }
                    });
                    catMap.set(catName.toLowerCase(), cat as any);
                }
                categoryId = cat.id;
            }

            // Resolve Manufacturer
            let manufacturerId = undefined;
            const mfgName = idxManufacturer !== -1 ? row[idxManufacturer]?.trim() : null;
            if (mfgName) {
                let mfg = mfgMap.get(mfgName.toLowerCase());
                if (!mfg) {
                    mfg = await prisma.hms_manufacturer.create({
                        data: {
                            id: crypto.randomUUID(),
                            tenant_id: tenantId,
                            company_id: companyId,
                            name: mfgName,
                            is_active: true
                        }
                    });
                    mfgMap.set(mfgName.toLowerCase(), mfg);
                }
                manufacturerId = mfg.id;
            }

            const metadata: any = {
                brand: mfgName || undefined,
                manufacturer: mfgName || undefined,
                generic_name: idxGeneric !== -1 ? row[idxGeneric] : undefined,
                hsn_code: idxHsn !== -1 ? row[idxHsn] : undefined,
                min_stock_level: idxMinStock !== -1 ? parseFloat(row[idxMinStock]) : undefined,
                mrp: mrp > 0 ? mrp : undefined,
                purchase_price: purchaseCost > 0 ? purchaseCost : undefined
            };

            const existingProduct = productMap.get(sanitizedSku);
            let productId: string;

            if (existingProduct) {
                const updated = await prisma.hms_product.update({
                    where: { id: existingProduct.id },
                    data: {
                        name,
                        price: salePrice > 0 ? salePrice : existingProduct.price,
                        description: idxDesc !== -1 && row[idxDesc] ? row[idxDesc] : existingProduct.description,
                        manufacturer_id: manufacturerId || existingProduct.manufacturer_id,
                        metadata: { ...(existingProduct.metadata as object), ...metadata }
                    }
                });
                productId = updated.id;
                updatedCount++;
            } else {
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
                        created_by: session.user.id,
                        default_barcode: idxBarcode !== -1 ? row[idxBarcode] : null,
                        manufacturer_id: manufacturerId,
                        metadata
                    }
                });
                productId = created.id;
                productMap.set(sanitizedSku, created as any);
                createdCount++;
            }

            // Category Linking (Bulk check later or Upsert simple)
            if (categoryId) {
                await prisma.hms_product_category_rel.upsert({
                    where: { product_id_category_id: { product_id: productId, category_id: categoryId } },
                    update: {},
                    create: { product_id: productId, category_id: categoryId }
                });
            }

            // Opening Stock (One upsert + one ledger)
            if (openingStock > 0) {
                let batchNo = (idxBatch !== -1 && row[idxBatch]) ? row[idxBatch] : `OPENING-${format(new Date(), 'yyyyMMdd')}`;
                const expiry = idxExpiry !== -1 && row[idxExpiry] ? new Date(row[idxExpiry]) : null;

                const batch = await prisma.hms_product_batch.upsert({
                    where: { tenant_id_company_id_product_id_batch_no: { tenant_id: tenantId, company_id: companyId, product_id: productId, batch_no: batchNo } },
                    create: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: productId,
                        batch_no: batchNo,
                        expiry_date: expiry,
                        qty_on_hand: new Prisma.Decimal(openingStock),
                        cost: new Prisma.Decimal(purchaseCost),
                        mrp: new Prisma.Decimal(mrp),
                        sale_price: new Prisma.Decimal(salePrice),
                        created_by: session.user.id
                    },
                    update: {
                        qty_on_hand: { increment: openingStock },
                        ...(purchaseCost > 0 && { cost: new Prisma.Decimal(purchaseCost) }),
                        ...(mrp > 0 && { mrp: new Prisma.Decimal(mrp) }),
                        ...(salePrice > 0 && { sale_price: new Prisma.Decimal(salePrice) }),
                        ...(expiry && { expiry_date: expiry })
                    }
                });

                await prisma.hms_stock_levels.upsert({
                    where: {
                        tenant_id_company_id_product_id_batch_id_location_id: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId,
                            batch_id: batch.id,
                            location_id: locationId
                        }
                    },
                    create: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: productId,
                        location_id: locationId,
                        batch_id: batch.id,
                        quantity: new Prisma.Decimal(openingStock)
                    },
                    update: { quantity: { increment: openingStock } }
                });

                await prisma.hms_stock_ledger.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        product_id: productId,
                        batch_id: batch.id,
                        movement_type: 'OPENING',
                        qty: new Prisma.Decimal(openingStock),
                        unit_cost: new Prisma.Decimal(purchaseCost),
                        total_cost: new Prisma.Decimal(openingStock * purchaseCost),
                        reference: `IMPORT-${batchNo}`
                    }
                });
            }
        } catch (e) {
            errors.push({ row: i + 1, error: (e as Error).message });
        }
    }

    revalidatePath('/hms/inventory/products');
    return {
        success: true,
        message: `Import complete. ${createdCount} created, ${updatedCount} updated.`,
        created: createdCount,
        updated: updatedCount,
        errors
    };
}

export async function getBatchHistory(batchId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return [];

    try {
        const history = await prisma.hms_stock_ledger.findMany({
            where: {
                batch_id: batchId,
                company_id: session.user.companyId
            },
            orderBy: { created_at: 'desc' }
        });
        return serialize(history);
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

    const companyId = session.user.companyId; // Store after null check

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get current batch and product info
            const batch = await tx.hms_product_batch.findUnique({
                where: {
                    id: batchId,
                    company_id: companyId
                }
            });
            if (!batch) throw new Error("Batch not found");

            // 2. Find Main Warehouse
            let warehouse = await tx.hms_stock_location.findFirst({
                where: {
                    company_id: companyId,
                    code: { equals: 'WH-MAIN' }
                }
            });

            if (!warehouse) {
                warehouse = await tx.hms_stock_location.findFirst({
                    where: { company_id: companyId }
                });
            }

            if (!warehouse) throw new Error("No stock location found");

            // 3. Update Batch Qty
            const updatedBatch = await tx.hms_product_batch.update({
                where: { id: batchId },
                data: { qty_on_hand: { increment: changeQty } }
            });

            // 4. Update Stock Levels
            const stockLevelWhere = {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                product_id: batch.product_id,
                location_id: warehouse.id,
                batch_id: batchId
            }

            const existingLevel = await tx.hms_stock_levels.findFirst({
                where: stockLevelWhere as any
            })

            if (existingLevel) {
                await tx.hms_stock_levels.update({
                    where: { id: existingLevel.id },
                    data: {
                        quantity: { increment: changeQty },
                        updated_at: new Date()
                    }
                })
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
                })
            }

            // 5. Create Ledger Entry
            await tx.hms_stock_ledger.create({
                data: {
                    tenant_id: session.user.tenantId as string,
                    company_id: session.user.companyId as string,
                    product_id: batch.product_id,
                    movement_type: changeQty > 0 ? 'adjustment-in' : 'adjustment-out',
                    qty: Math.abs(changeQty),
                    batch_id: batchId,
                    reference: reason,
                    to_location_id: changeQty > 0 ? warehouse.id : null,
                    from_location_id: changeQty < 0 ? warehouse.id : null,
                    metadata: {
                        previous_qty: Number(batch.qty_on_hand),
                        new_qty: Number(updatedBatch.qty_on_hand),
                        adjusted_by: session.user.name
                    }
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

export async function searchProducts(query: string) { return await inventorySearch.searchProducts(query); }

export async function bulkUpdateProducts(productIds: string[], updates: {
    categoryId?: string;
    isService?: boolean;
    isStockable?: boolean;
    isActive?: boolean;
    price?: number;
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!companyId || !tenantId) return { error: "Unauthorized" };
    if (!productIds || productIds.length === 0) return { error: "No products selected" };

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update Core Product Fields
            const data: any = {};
            if (updates.isService !== undefined) data.is_service = updates.isService;
            if (updates.isStockable !== undefined) data.is_stockable = updates.isStockable;
            if (updates.isActive !== undefined) data.is_active = updates.isActive;
            if (updates.price !== undefined) data.price = updates.price;
            if (updates.categoryId !== undefined) {
                // We'll update the relationship below
            }

            if (Object.keys(data).length > 0) {
                await tx.hms_product.updateMany({
                    where: { id: { in: productIds }, company_id: companyId },
                    data
                });
            }

            // 2. Update Category Relationships if needed
            if (updates.categoryId) {
                // Delete old associations for these products
                await tx.hms_product_category_rel.deleteMany({
                    where: { product_id: { in: productIds } }
                });

                // Create new associations
                const rels = productIds.map(pid => ({
                    product_id: pid,
                    category_id: updates.categoryId as string
                }));

                await tx.hms_product_category_rel.createMany({
                    data: rels
                });
            }
        });

        revalidatePath('/hms/inventory/products');
        return { success: true, message: `Successfully updated ${productIds.length} items.` };
    } catch (error: any) {
        console.error("Bulk update failure:", error);
        return { error: error.message || "Failed to execute bulk update." };
    }
}

export async function rapidStockOnboarding(data: {
    barcode?: string;
    productId?: string;
    productName: string;
    categoryId?: string;
    batches: {
        batchNo: string;
        expiryDate?: string;
        mrp: number;
        cost: number;
        salePrice?: number;
        qty: number;
        uom?: string;
        conversionFactor?: number;
    }[]
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!companyId || !tenantId) return { error: "Session expired. Please re-login." };
    if (data.batches.length === 0) return { error: "No batch data provided" };

    console.log("MOBILE AUDIT START:", { productName: data.productName, barcode: data.barcode, batchesCount: data.batches.length });

    try {
        const result = await prisma.$transaction(async (tx) => {
            let productId = data.productId;

            // 1. Find or Create Product
            if (!productId) {
                console.log("CREATING NEW PRODUCT:", data.productName);
                const prefix = data.productName.substring(0, 3).toUpperCase();
                const random = Math.floor(Math.random() * 10000);
                const sku = `${prefix}-${random}`;

                const newProduct = await tx.hms_product.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        name: data.productName,
                        sku: sku,
                        default_barcode: data.barcode,
                        is_active: true,
                        is_stockable: true
                    }
                });
                productId = newProduct.id;
                console.log("PRODUCT CREATED ID:", productId);

                if (data.categoryId) {
                    await tx.hms_product_category_rel.create({
                        data: {
                            product_id: productId,
                            category_id: data.categoryId
                        }
                    });
                }
            } else {
                // [SYNC-ENHANCEMENT] Synchronize master details if provided during audit
                await tx.hms_product.update({
                    where: { id: productId },
                    data: {
                        name: data.productName,
                        default_barcode: data.barcode || undefined
                    }
                });

                if (data.categoryId) {
                    await tx.hms_product_category_rel.upsert({
                        where: { product_id: productId },
                        create: { product_id: productId, category_id: data.categoryId },
                        update: { category_id: data.categoryId }
                    });
                }
            }

            // 2. Process Batches
            for (const b of data.batches) {
                const factor = Number(b.conversionFactor) || 1;
                const unitsToSync = Number(b.qty) * factor;
                const unitMRP = Number(b.mrp) / factor;
                const incomingCost = Number(b.cost) / factor;
                const unitSale = (Number(b.salePrice) || Number(b.mrp)) / factor;

                console.log("PROCESSING BATCH:", b.batchNo, "Final Units:", unitsToSync);
                
                // 1. Fetch Existing Batch (Priority 1 for Cost Recovery)
                let batch = await tx.hms_product_batch.findUnique({
                    where: {
                        tenant_id_company_id_product_id_batch_no: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId as string,
                            batch_no: b.batchNo
                        }
                    }
                });

                // --- WORLD STANDARD: Intelligent Cost Recovery ---
                let finalUnitCost = incomingCost;
                if (finalUnitCost <= 0) {
                    if (batch && Number(batch.cost) > 0) {
                        finalUnitCost = Number(batch.cost); // Use existing batch cost
                        console.log("RECOVERED COST from existing batch:", finalUnitCost);
                    } else {
                        // Priority 2: Product Master Default Cost
                        const masterProd = await tx.hms_product.findUnique({
                            where: { id: productId as string },
                            select: { default_cost: true }
                        });
                        const masterCost = Number(masterProd?.default_cost) || 0;
                        if (masterCost > 0) {
                            finalUnitCost = masterCost;
                            console.log("RECOVERED COST from product master:", finalUnitCost);
                        } else {
                            // Priority 3: Market Margin Fallback (70% of MRP)
                            finalUnitCost = unitMRP * 0.7; 
                            console.log("RECOVERED COST via 30% Margin Guess:", finalUnitCost);
                        }
                    }
                }

                if (!batch) {
                    console.log("CREATING NEW BATCH RECORD:", b.batchNo);
                    batch = await tx.hms_product_batch.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId as string,
                            batch_no: b.batchNo,
                            expiry_date: b.expiryDate ? new Date(b.expiryDate) : null,
                            mrp: new Prisma.Decimal(unitMRP),
                            cost: new Prisma.Decimal(finalUnitCost),
                            sale_price: new Prisma.Decimal(unitSale),
                            qty_on_hand: 0
                        }
                    });
                } else {
                    // [SYNC-ENHANCEMENT] Update pricing and EXPIRY on existing batch during audit
                    await tx.hms_product_batch.update({
                        where: { id: batch.id },
                        data: {
                            mrp: new Prisma.Decimal(unitMRP),
                            cost: new Prisma.Decimal(finalUnitCost),
                            sale_price: new Prisma.Decimal(unitSale),
                            expiry_date: b.expiryDate ? new Date(b.expiryDate) : batch.expiry_date
                        }
                    });
                }

                // 3. Find/Create Godown
                let location = await tx.hms_stock_location.findFirst({
                    where: { company_id: companyId }
                });

                if (!location) {
                    console.log("LOCATION MISSING - AUTO PROVISIONING MAIN GODOWN");
                    location = await tx.hms_stock_location.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            code: 'MAIN',
                            name: 'Main Godown',
                            location_type: 'warehouse'
                        }
                    });
                }

                console.log("SYNCING TO LOCATION:", location.name);

                // 4. Update Stock & Ledger (Audit Style: Set Absolute)
                const currentQty = Number(batch.qty_on_hand) || 0;
                const adjustment = unitsToSync - currentQty;

                await tx.hms_product_batch.update({
                    where: { id: batch.id },
                    data: { qty_on_hand: unitsToSync }
                });

                await tx.hms_stock_levels.upsert({
                    where: {
                        tenant_id_company_id_product_id_batch_id_location_id: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            location_id: location.id,
                            product_id: productId as string,
                            batch_id: batch.id
                        }
                    },
                    update: { quantity: unitsToSync },
                    create: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        location_id: location.id,
                        product_id: productId as string,
                        batch_id: batch.id,
                        quantity: unitsToSync
                    }
                });

                if (adjustment !== 0) {
                    await tx.hms_stock_ledger.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            product_id: productId as string,
                            batch_id: batch.id,
                            movement_type: adjustment > 0 ? 'adjustment_in' : 'adjustment_out',
                            qty: Math.abs(adjustment),
                            to_location_id: location.id,
                            reference: `Physical Audit: ${b.qty} ${b.uom}`
                        }
                    });
                }
            }

            return { success: true, productId };
        });

        console.log("MOBILE AUDIT SUCCESS:", result.productId);
        return result;
    } catch (err: any) {
        console.error("MOBILE AUDIT SERVER ERROR:", err);
        return { error: err.message || "Operation failed on server. Contact IT." };
    }
}
export async function getLastMarginForProduct(productId: string, supplierId: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        // Find the latest receipt line for this product and supplier
        const lastLine = await prisma.hms_purchase_receipt_line.findFirst({
            where: {
                product_id: productId,
                hms_purchase_receipt: {
                    supplier_id: supplierId,
                    company_id: session.user.companyId
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            select: {
                unit_price: true,
                batch_id: true
            }
        });

        if (!lastLine?.batch_id) return { success: false, message: "No history found" };

        // Get the margin from the batch
        const batch = await prisma.hms_product_batch.findUnique({
            where: { id: lastLine.batch_id },
            select: {
                margin_percentage: true,
                sale_price: true,
                cost: true
            }
        });

        if (!batch) return { success: false, message: "Batch not found" };

        return {
            success: true,
            marginPct: Number(batch.margin_percentage || 0),
            salePrice: Number(batch.sale_price || 0),
            cost: Number(batch.cost || 0)
        };
    } catch (e) {
        return { error: (e as Error).message };
    }
}
