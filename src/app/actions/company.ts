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

export async function getCurrentCompany() {
    const session = await auth();
    const companyId = session?.user?.companyId;

    if (!companyId) {
        // Fallback or if not in session
        if (!session?.user?.id) return null;
        const user = await prisma.app_user.findUnique({
            where: { id: session.user.id },
            select: { company_id: true }
        });
        if (!user?.company_id) return null;
        return await prisma.company.findUnique({ where: { id: user.company_id } });
    }

    try {
        if (!companyId) return null;

        // Ensure we handle potential invalid UUID formats gracefully
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true, industry: true, logo_url: true, metadata: true }
        });

        if (!company) {
            console.warn(`getCurrentCompany: Company not found for ID: ${companyId}`);
        }

        return company;
    } catch (error) {
        console.error(`getCurrentCompany ERROR [ID: ${companyId}]:`, error);
        // Fallback: try to find any company for this user if the specific ID fails
        try {
            if (session?.user?.id) {
                const user = await prisma.app_user.findUnique({
                    where: { id: session.user.id },
                    select: { tenant_id: true }
                });
                if (user?.tenant_id) {
                    return await prisma.company.findFirst({
                        where: { tenant_id: user.tenant_id },
                        select: { id: true, name: true, industry: true, logo_url: true, metadata: true }
                    });
                }
            }
        } catch (innerError) {
            console.error("Critical failure in getCurrentCompany fallback:", innerError);
        }
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
