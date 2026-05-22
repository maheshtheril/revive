
'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { ensureDefaultAccounts } from "@/lib/account-seeder"

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export async function getAccounts(search?: string, typeFilter?: string[]) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { error: "Unauthorized" };

    try {
        const where: any = {
            company_id: companyId,
            is_active: true
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (typeFilter && typeFilter.length > 0) {
            where.type = { in: typeFilter };
        }

        const accounts = await prisma.accounts.findMany({
            where,
            orderBy: { code: 'asc' }
        });

        // If no accounts exist, try to seed them automatically
        if (accounts.length === 0 && !search) {
            console.log("No accounts found. Triggering auto-seed...");
            await ensureDefaultAccounts(session.user.companyId, session.user.tenantId || session.user.companyId); // fallback

            // Re-fetch
            const seededAccounts = await prisma.accounts.findMany({
                where: { company_id: session.user.companyId, is_active: true },
                orderBy: { code: 'asc' }
            });
            return { success: true, data: seededAccounts };
        }

        return { success: true, data: accounts };
    } catch (error: any) {
        console.error("Error fetching accounts:", error);
        return { error: error.message };
    }
}

export async function upsertAccount(data: {
    id?: string;
    code: string;
    name: string;
    type: string;
    parent_id?: string | null;
    is_group?: boolean;
    is_reconcilable?: boolean;
    description?: string;
}) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return { error: "Unauthorized" };

    try {
        // Validate code uniqueness if creating new
        if (!data.id) {
            const existing = await prisma.accounts.findFirst({
                where: {
                    company_id: session.user.companyId,
                    code: data.code
                }
            });
            if (existing) {
                return { error: `Account with code ${data.code} already exists.` };
            }
        }

        const account = await prisma.accounts.upsert({
            where: {
                id: data.id || 'new', // 'new' won't match any UUID
            },
            update: {
                code: data.code,
                name: data.name,
                type: data.type,
                parent_id: data.parent_id,
                is_group: data.is_group || false,
                is_reconcilable: data.is_reconcilable || false,
                // metadata: { description: data.description } 
            },
            create: {
                id: data.id,
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                code: data.code,
                name: data.name,
                type: data.type,
                parent_id: data.parent_id,
                is_group: data.is_group || false,
                is_reconcilable: data.is_reconcilable || false,
                is_active: true,
                // metadata: { description: data.description }
            }
        });

        revalidatePath('/accounting/coa');
        return { success: true, data: account };

    } catch (error: any) {
        // Fallback upsert logic relying on findUnique constraints might not work if 'new' is used as ID.
        // So we strictly try update if ID passed, create if not.
        try {
            if (data.id) {
                await prisma.accounts.update({
                    where: { id: data.id },
                    data: {
                        code: data.code,
                        name: data.name,
                        type: data.type,
                        parent_id: data.parent_id,
                        is_group: data.is_group,
                        is_reconcilable: data.is_reconcilable
                    }
                });
            } else {
                const company = await prisma.companies.findUnique({ where: { id: session.user.companyId } });
                await prisma.accounts.create({
                    data: {
                        tenant_id: session.user.tenantId,
                        company_id: session.user.companyId,
                        code: data.code,
                        name: data.name,
                        type: data.type,
                        parent_id: data.parent_id,
                        is_group: data.is_group,
                        is_reconcilable: data.is_reconcilable,
                        is_active: true
                    }
                });
            }
            revalidatePath('/accounting/coa');
            return { success: true };
        } catch (innerError: any) {
            console.error("Inner Error Upserting Account:", innerError);
            return { error: innerError.message };
        }
    }
}

export async function deleteAccount(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        // 1. Check for transactions (journal entry lines)
        const transactionsCount = await prisma.journal_entry_lines.count({
            where: { account_id: id }
        });

        if (transactionsCount > 0) {
            return { error: "Cannot delete account. Transactions exist for this ledger." };
        }

        // 2. Check for child accounts if it's a group
        const childrenCount = await prisma.accounts.count({
            where: { parent_id: id, is_active: true }
        });

        if (childrenCount > 0) {
            return { error: "Cannot delete group. It contains other sub-groups or ledgers." };
        }

        // 3. Perform actual deletion if no transactions/children exist
        await prisma.accounts.delete({
            where: { id }
        });

        revalidatePath('/hms/accounting/coa');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting account:", error);
        // Fallback to deactivation if delete fails (e.g. foreign key constraint elsewhere)
        try {
            await prisma.accounts.update({
                where: { id },
                data: { is_active: false }
            });
            revalidatePath('/hms/accounting/coa');
            return { success: true, message: "Account deactivated instead of deleted due to constraints." };
        } catch (e) {
            return { error: error.message };
        }
    }
}
