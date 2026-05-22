'use server'
import crypto from 'crypto';

import { prisma } from "@/lib/prisma"
import { signOut } from "@/auth"
import { headers } from "next/headers";
import bcrypt from 'bcryptjs';
import { initializeTenantMasters } from "@/lib/services/tenant-init";
import { SYSTEM_DEFAULT_CURRENCY_CODE } from "@/lib/currency-constants";
import { ensureDefaultAccounts } from "@/lib/account-seeder";

export async function logout() {
    console.log("[Auth Action] Logging out...");
    try {
        await signOut({ redirectTo: '/login' });
    } catch (err) {
        // Next.js redirects act as errors, so we need to rethrow them if it's a redirect
        if ((err as Error).message === 'NEXT_REDIRECT') {
            throw err;
        }
        console.error("[Auth Action] Logout failed:", err);
        throw err;
    }
}

export async function signup(prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const email = (rawData.email as string || '').toLowerCase();
    const password = rawData.password as string
    const name = rawData.name as string
    const companyName = rawData.companyName as string
    const countryId = rawData.countryId as string
    const currencyId = rawData.currencyId as string
    const industry = rawData.industry as string
    const selectedModules = (rawData.modules as string || '').split(',').filter(Boolean);
    const taxId = rawData.taxId as string // Optional tax ID if they selected one
    const address = (rawData.address as string) || '';
    const phone = (rawData.phone as string) || '';

    if (!email || !password || !name || !companyName) {
        return { error: "Missing required fields" }
    }

    try {
        const existing = await prisma.app_user.findFirst({ where: { email } })
        if (existing) {
            return { error: "A user with this email already exists." }
        }
        const inputCountryId = rawData.countryId as string;
        let resolvedCountryId = inputCountryId;

        // Defensive check: if countryId is an ISO code (e.g. "IN"), resolve it to UUID
        if (countryId && (countryId.length === 2 || countryId.length === 3)) {
            const countryDoc = await prisma.countries.findFirst({
                where: { OR: [{ iso2: countryId }, { iso3: countryId }] },
                select: { id: true }
            });
            if (countryDoc) resolvedCountryId = countryDoc.id;
            else resolvedCountryId = ""; // Invalid ISO code
        }

        const inputCurrencyId = rawData.currencyId as string;
        let resolvedCurrencyId = inputCurrencyId;

        // Defensive check: if currencyId is a code (e.g. "INR"), resolve it to UUID
        if (currencyId && currencyId.length === 3 && !/^[0-9a-fA-F-]{36}$/.test(currencyId)) {
            const currencyDoc = await prisma.currencies.findFirst({
                where: { code: currencyId },
                select: { id: true }
            });
            if (currencyDoc) resolvedCurrencyId = currencyDoc.id;
        }

        if (existing) return { error: "User already exists" }

        const tenantId = crypto.randomUUID();
        const companyId = crypto.randomUUID();
        const branchId = crypto.randomUUID();
        const userId = crypto.randomUUID();

        // [NEW] Resolve Currency Code for Seeding (Dynamic - No Hardcoding)
        let resolvedCurrencyCode = SYSTEM_DEFAULT_CURRENCY_CODE;
        if (resolvedCurrencyId) {
            const cur = await prisma.currencies.findUnique({
                where: { id: resolvedCurrencyId },
                select: { code: true }
            });
            if (cur) resolvedCurrencyCode = cur.code;
        }

        // PHASE 1: CORE IDENTITY (Sequential - bypassing transaction for pooler stability)
        console.log(`[AUTH] Starting Core Creation for ${email}`);

        // 1. Create Tenant
        await prisma.tenant.create({
            data: {
                id: tenantId,
                name: `${companyName} (Tenant)`,
                slug: companyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            }
        });

        // 2. Create Company
        await prisma.company.create({
            data: {
                id: companyId,
                tenant_id: tenantId,
                name: companyName,
                country_id: resolvedCountryId || undefined,
                industry: industry,
                enabled: true,
                metadata: {
                    address: address,
                    phone: phone,
                    email: email
                }
            }
        });

        // 3. Create Default Main Branch
        const isHms = selectedModules.includes('hms');
        await prisma.hms_branch.create({
            data: {
                id: branchId,
                tenant_id: tenantId,
                company_id: companyId,
                name: isHms ? "Main Clinic" : "Head Office",
                code: "MAIN",
                is_active: true,
                type: isHms ? "clinic" : "office",
                address: address,
                phone: phone,
                email: email,
                metadata: {
                    address: address,
                    phone: phone,
                    email: email
                }
            }
        });

        // 4. Create App User
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.app_user.create({
            data: {
                id: userId,
                tenant_id: tenantId,
                company_id: companyId,
                current_branch_id: branchId,
                email: email.toLowerCase(),
                password: hashedPassword,
                name: name,
                is_admin: true,
                is_active: true
            }
        });

        await prisma.user_branch.create({
            data: { user_id: userId, branch_id: branchId, is_default: true }
        });

        // 5. Create Default Roles
        const superAdminRoleId = crypto.randomUUID();
        const defaultRoles = [
            { id: superAdminRoleId, key: 'super_admin', name: 'Super Administrator', permissions: ['*'] },
            { key: 'admin', name: 'Administrator', permissions: ['users:view', 'users:create', 'users:edit', 'hms:admin', 'crm:admin'] },
            { key: 'hms_admin', name: 'HMS Administrator', permissions: ['hms:view', 'patients:view', 'billing:view'] },
            { key: 'doctor', name: 'Doctor', permissions: ['patients:view', 'appointments:view', 'prescriptions:create'] },
            { key: 'nurse', name: 'Nurse', permissions: ['patients:view', 'vitals:create'] },
            { key: 'receptionist', name: 'Receptionist', permissions: ['patients:create', 'appointments:create', 'billing:create'] },
            { key: 'sales_executive', name: 'Sales Executive', permissions: ['crm:view_own', 'leads:create'] },
        ];

        await prisma.role.createMany({
            data: defaultRoles.map(r => ({
                id: r.id || crypto.randomUUID(),
                tenant_id: tenantId,
                key: r.key,
                name: r.name,
                permissions: r.permissions
            }))
        });

        await prisma.user_role.create({
            data: { id: crypto.randomUUID(), user_id: userId, role_id: superAdminRoleId, tenant_id: tenantId }
        });

        // PHASE 2: DOMAIN INITIALIZATION (Background/Secondary)
        console.log(`[AUTH] Core Creation Successful. Starting Background Init for ${email}`);

        try {
            // 6. Settings & Tax
            if (resolvedCurrencyId) {
                await prisma.company_settings.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        currency_id: resolvedCurrencyId,
                    }
                });

                if (resolvedCountryId) {
                    const defaultMappings = await prisma.country_tax_mappings.findMany({
                        where: { country_id: resolvedCountryId, is_active: true }
                    });
                    if (defaultMappings.length > 0) {
                        await prisma.company_tax_maps.createMany({
                            data: defaultMappings.map(dm => ({
                                id: crypto.randomUUID(),
                                tenant_id: tenantId,
                                company_id: companyId,
                                country_id: resolvedCountryId,
                                tax_type_id: dm.tax_type_id,
                                tax_rate_id: dm.tax_rate_id,
                                is_default: false,
                                is_active: true
                            }))
                        });
                    }
                }
            }

            // 7. Chart of Accounts (World-Standard Seeding)
            if (resolvedCurrencyId) {
                await ensureDefaultAccounts(companyId, tenantId);
            }

            // 8. Modules
            let modulesToEnable = new Set(['system', ...selectedModules]);
            const validModules = await prisma.modules.findMany({
                where: { module_key: { in: Array.from(modulesToEnable) } }
            });

            if (validModules.length > 0) {
                await prisma.tenant_module.createMany({
                    data: validModules.map(m => ({
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        module_key: m.module_key,
                        module_id: m.id,
                        enabled: true
                    })),
                    skipDuplicates: true
                });
            }

            // 9. Master Seeding (Standard UOMs, Roles, etc.)
            await initializeTenantMasters(tenantId, companyId, prisma);
            const { seedCompanyTaxes } = await import("@/lib/services/tax-seed");
            await seedCompanyTaxes(companyId, prisma);

            // 10. Default Products (HMS Only)
            if (modulesToEnable.has('hms')) {
                const standardProducts = [
                    { sku: 'REG-FEE', name: 'Patient Registration Fee', uom: 'EACH', price: 150, is_service: true, stockable: false },
                    { sku: 'CONS-GEN', name: 'General Consultation', uom: 'VISIT', price: 250, is_service: true, stockable: false },
                    { sku: 'CONS-SPEC', name: 'Specialist Consultation', uom: 'VISIT', price: 500, is_service: true, stockable: false },
                    { sku: 'PARA-500', name: 'Paracetamol 500mg', uom: 'TAB', price: 5, is_service: false, stockable: true },
                    { sku: 'AMOX-500', name: 'Amoxicillin 500mg Strip', uom: 'STRIP', price: 85, is_service: false, stockable: true },
                    { sku: 'SYR-5ML', name: 'Disposable Syringe 5ml', uom: 'PCS', price: 15, is_service: false, stockable: true },
                    { sku: 'CBC-TEST', name: 'Complete Blood Count (CBC)', uom: 'TEST', price: 450, is_service: true, stockable: false },
                    { sku: 'CXR-SCAN', name: 'Chest X-Ray', uom: 'SCAN', price: 1200, is_service: true, stockable: false },
                ];

                await prisma.hms_product.createMany({
                    data: standardProducts.map(p => ({
                        id: crypto.randomUUID(),
                        tenant_id: tenantId,
                        company_id: companyId,
                        sku: p.sku,
                        name: p.name,
                        is_service: p.is_service,
                        is_stockable: p.stockable,
                        price: p.price,
                        currency: resolvedCurrencyCode,
                        is_active: true,
                        uom: p.uom,
                        metadata: { tax_exempt: true }
                    }))
                });
            }
        } catch (initError) {
            console.error("[AUTH] Domain Initialization failed, but User exists:", initError);
        }

        return { success: true };

    } catch (error) {
        // WORLD-CLASS ERROR REPORTING: Prevent generic 500s
        const err = error as Error;
        console.error("[AUTH] Fatal signup error:", err);
        return {
            error: `Registration failed: ${err.message || "Unknown error"}. Please check server logs for Digest: 1401391270 correlate.`
        };
    }
}
