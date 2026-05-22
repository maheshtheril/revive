'use server'

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function getTenantCompanies() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        // Fetch user to get tenant_id
        const user = await prisma.app_user.findUnique({
            where: { id: session.user.id },
            select: { tenant_id: true }
        });

        if (!user) return { error: "User not found" };

        const companies = await prisma.company.findMany({
            where: { tenant_id: user.tenant_id },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                industry: true,
                enabled: true,
                logo_url: true,
            }
        });

        return { success: true, data: companies };
    } catch (error) {
        console.error("Failed to fetch companies:", error);
        return { error: "Failed to fetch companies" };
    }
}

/**
 * WORLD-CLASS SERIALIZATION GATEWAY
 * Prevents 'Module Factory not Available' errors by ensuring props are 100% plain objects.
 */
function bridge(obj: any) {
    if (!obj) return null;
    try {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (value && typeof value.toNumber === 'function') return value.toNumber();
            return value;
        }));
    } catch (e) {
        return obj;
    }
}

export async function getCurrentCompany() {
    try {
        const result = await getCurrentCompanyInternal();
        return bridge(result);
    } catch (e) {
        console.error("Critical Failure in getCurrentCompany:", e);
        return null;
    }
}

async function getCurrentCompanyInternal() {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const branchId = session?.user?.current_branch_id;

    if (branchId) {
        try {
            const branch = await prisma.hms_branch.findUnique({
                where: { id: branchId },
                include: { company: { include: { company_settings: true } } }
            });
            if (branch && branch.company) {
                const settings = (branch.company as any).company_settings?.[0] || {};
                const bMeta: any = branch.metadata || {};
                const cMeta: any = branch.company.metadata || {};
                
                // COMBINED GREEDY RESOLVER (Hardened to skip empty strings)
                const resolvedAddress = (branch as any).address || (settings as any).address || 
                                        `${(settings as any).address_city || ''} ${(settings as any).address_state || ''} ${(settings as any).address_zip || ''}`.trim() || 
                                        (bMeta.address && bMeta.address.trim() !== "" ? bMeta.address : null) || 
                                        (bMeta.hospital_address && bMeta.hospital_address.trim() !== "" ? bMeta.hospital_address : null) || 
                                        (cMeta.address && cMeta.address.trim() !== "" ? cMeta.address : null) || 
                                        (cMeta.hospital_address && cMeta.hospital_address.trim() !== "" ? cMeta.hospital_address : null) || 
                                        (branch.company as any).address;

                const resolvedPhone = (branch as any).phone || (settings as any).phone || 
                                      (bMeta.phone && bMeta.phone.trim() !== "" ? bMeta.phone : null) || 
                                      (bMeta.mobile && bMeta.mobile.trim() !== "" ? bMeta.mobile : null) || 
                                      (bMeta.contact_no && bMeta.contact_no.trim() !== "" ? bMeta.contact_no : null) || 
                                      (cMeta.phone && cMeta.phone.trim() !== "" ? cMeta.phone : null) || 
                                      (cMeta.mobile && cMeta.mobile.trim() !== "" ? cMeta.mobile : null) || 
                                      (cMeta.contact_no && cMeta.contact_no.trim() !== "" ? cMeta.contact_no : null) || 
                                      (branch.company as any).phone;

                const resolvedEmail = (branch as any).email || (settings as any).email || 
                                      (bMeta.email && bMeta.email.trim() !== "" ? bMeta.email : null) || 
                                      (bMeta.email_id && bMeta.email_id.trim() !== "" ? bMeta.email_id : null) || 
                                      (cMeta.email && cMeta.email.trim() !== "" ? cMeta.email : null) || 
                                      (cMeta.email_id && cMeta.email_id.trim() !== "" ? cMeta.email_id : null) || 
                                      (branch.company as any).email;

                return {
                    id: branch.id,
                    name: (branch.company as any).name || cMeta.hospital_name || branch.name,
                    industry: 'Healthcare',
                    logo_url: bMeta.logo_url || cMeta.logo_url || branch.company.logo_url,
                    address: resolvedAddress,
                    phone: resolvedPhone,
                    email: resolvedEmail,
                    metadata: { ...cMeta, ...bMeta },
                    tenant_id: branch.tenant_id,
                    is_branch: true
                };
            }
        } catch (e) {
            console.error("Branch Fetch Error:", e);
        }
    }

    let activeCompanyId = companyId;
    if (!activeCompanyId) {
        // Fallback to the primary hospital company if session cache loses companyId
        const fallbackCompany = await prisma.company.findFirst({
            orderBy: { created_at: 'asc' }
        });
        if (fallbackCompany) activeCompanyId = fallbackCompany.id;
        else return null;
    }

    try {
        const company = await prisma.company.findUnique({
            where: { id: activeCompanyId },
            include: { company_settings: true }
        });

        if (!company) return null;

        const settings = (company as any).company_settings?.[0] || {};
        const meta: any = company.metadata || {};

        // WORLD-CLASS GREEDY RESOLVER: Address | Mobile | Email (Hardened)
        const resolvedAddress = (company as any).address || (settings as any).address || 
                                `${(settings as any).address_city || ''} ${(settings as any).address_state || ''} ${(settings as any).address_zip || ''}`.trim() || 
                                (meta.address && meta.address.trim() !== "" ? meta.address : null) || 
                                (meta.hospital_address && meta.hospital_address.trim() !== "" ? meta.hospital_address : null) || 
                                "Medical Square, City Center";

        const resolvedPhone = (company as any).phone || (settings as any).phone || 
                              (meta.phone && meta.phone.trim() !== "" ? meta.phone : null) || 
                              (meta.mobile && meta.mobile.trim() !== "" ? meta.mobile : null) || 
                              (meta.contact_no && meta.contact_no.trim() !== "" ? meta.contact_no : null) || 
                              "+91 000 000 0000";

        const resolvedEmail = (company as any).email || (settings as any).email || 
                              (meta.email && meta.email.trim() !== "" ? meta.email : null) || 
                              (meta.email_id && meta.email_id.trim() !== "" ? meta.email_id : null) || 
                              (company as any).email || "contact@hospital.com";

        return { 
            ...company, 
            name: (company as any).name || meta.hospital_name || "GLOBAL MEDICARE",
            address: resolvedAddress,
            phone: resolvedPhone,
            email: resolvedEmail,
            metadata: meta
        };
    } catch (e) {
        console.error("Company Fetch Error:", e);
        return null;
    }
}

export async function switchCompany(companyId: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        const user = await prisma.app_user.findUnique({
            where: { id: session.user.id },
            select: { tenant_id: true }
        });

        if (!user) return { error: "User not found" };

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                tenant_id: true,
                enabled: true,
                branches: {
                    where: { is_active: true },
                    take: 1,
                    select: { id: true }
                }
            }
        });

        if (!company || company.tenant_id !== user.tenant_id) {
            return { error: "Invalid company" };
        }

        if (!company.enabled) {
            return { error: "Company is inactive" };
        }

        // When switching company, auto-switch to the first/default branch
        const defaultBranchId = company.branches[0]?.id;

        await prisma.app_user.update({
            where: { id: session.user.id },
            data: {
                company_id: companyId,
                current_branch_id: defaultBranchId || null
            }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to switch company:", error);
        return { error: "Failed to switch company" };
    }
}

export async function getBranches(companyId?: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        const cid = companyId || session.user.companyId;
        if (!cid) return { data: [] };

        const branches = await prisma.hms_branch.findMany({
            where: {
                company_id: cid,
                is_active: true
            },
            orderBy: { name: 'asc' }
        });

        return { success: true, data: branches };
    } catch (error) {
        return { error: "Failed to fetch branches" };
    }
}

export async function switchBranch(branchId: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        // Verify user has access to this branch
        const access = await prisma.user_branch.findUnique({
            where: {
                user_id_branch_id: {
                    user_id: session.user.id,
                    branch_id: branchId
                }
            }
        });

        if (!access && !session.user.isAdmin) {
            return { error: "Access denied to this branch" };
        }

        await prisma.app_user.update({
            where: { id: session.user.id },
            data: { current_branch_id: branchId }
        });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        return { error: "Failed to switch branch" };
    }
}

export async function createCompany(data: {
    name: string;
    industry?: string;
    country_id?: string;
    currency_id?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    gstin?: string;
    registration_number?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    // Basic validation
    if (!data.name) return { error: "Company name is required" };

    try {
        const user = await prisma.app_user.findUnique({
            where: { id: session.user.id },
            select: { tenant_id: true }
        });

        if (!user) return { error: "User not found" };

        const companyId = crypto.randomUUID();

        // Fetch existing company defaults if not provided
        let countryId = data.country_id;
        let currencyId = data.currency_id;
        let industry = data.industry;

        // Try to get defaults from existing tenant company
        const existingCompany = await prisma.company.findFirst({
            where: { tenant_id: user.tenant_id },
            orderBy: { created_at: 'asc' },
            include: {
                company_settings: true,
            }
        });

        if (existingCompany) {
            if (!countryId) countryId = existingCompany.country_id || undefined;
            if (!industry) industry = existingCompany.industry || undefined;
            if (!currencyId && existingCompany.company_settings) {
                currencyId = existingCompany.company_settings.currency_id;
            }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Create Company
            await tx.company.create({
                data: {
                    id: companyId,
                    tenant_id: user.tenant_id,
                    name: data.name,
                    industry: industry,
                    country_id: countryId,
                    enabled: true,
                    metadata: {
                        phone: data.phone,
                        email: data.email,
                        website: data.website,
                        address: data.address,
                        gstin: data.gstin,
                        registration_number: data.registration_number
                    }
                }
            });

            // 2. Create Company Settings (Currency)
            if (currencyId) {
                await tx.company_settings.create({
                    data: {
                        tenant_id: user.tenant_id,
                        company_id: companyId,
                        currency_id: currencyId,
                        // Inherit other settings if available from existing company?
                        // For now just currency as requested.
                    }
                });
            }

            // 3. Inherit Taxes from Existing Company
            if (existingCompany) {
                const existingTaxes = await tx.company_taxes.findMany({
                    where: { company_id: existingCompany.id, is_active: true }
                });

                if (existingTaxes.length > 0) {
                    await tx.company_taxes.createMany({
                        data: existingTaxes.map(tax => ({
                            company_id: companyId,
                            name: tax.name,
                            code: tax.code,
                            rate: tax.rate, // Decimal
                            is_active: true,
                            metadata: tax.metadata || {}
                        }))
                    });
                }
            }

            // 4. Optional: Initialize default Chart of Accounts, etc.
        });

        revalidatePath('/hms/settings/companies');
        return { success: true, companyId };

    } catch (error) {
        console.error("Failed to create company:", error);
        return { error: "Failed to create company" };
    }
}
