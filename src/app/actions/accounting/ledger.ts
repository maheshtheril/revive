
'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { serialize } from "@/lib/utils"

export async function getAccountLedger(accountId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const where: any = {
            company_id: session.user.companyId,
            account_id: accountId
        };

        // Filter by Date via Journal Entry Header relation?
        // Prisma filtering on relation:
        if (filters?.startDate || filters?.endDate) {
            where.journal_entries = {
                date: {
                    ...(filters?.startDate && { gte: filters.startDate }),
                    ...(filters?.endDate && { lte: filters.endDate })
                }
            };
        }

        const lines = await (prisma.journal_entry_lines.findMany as any)({
            where,
            include: {
                journal_entries: {
                    select: {
                        date: true,
                        ref: true,
                        posted: true,
                        journal_id: true,
                        journals: { select: { name: true, code: true } }
                    }
                },
                accounts: { select: { name: true, code: true } }
            },
            orderBy: {
                created_at: 'desc' // Changed from journal_entries.date since relations can't be used in orderBy
            },
            take: filters?.limit || 100
        });

        // Compute Running Balance?
        // To do this accurately, we need previous balance. Sometime expensive.
        // For now, let's just return the lines.
        // If we order by date desc, running balance is hard.
        // Standard practice: Show lines + Total Debit/Credit for period.

        // Fetch Account Details
        const account = await prisma.accounts.findUnique({
            where: { id: accountId },
            select: { name: true, code: true, type: true, id: true }
        });

        return { success: true, data: serialize(lines), account };

    } catch (error: any) {
        console.error("Error fetching ledger:", error);
        return { error: error.message };
    }
}
