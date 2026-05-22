'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

/**
 * Fetches the General Ledger for any account or partner.
 * Designed for Tally ERP-style Financial Reporting.
 */
export async function getGeneralLedgerReport(filters: {
    accountId?: string;
    partnerId?: string;
    startDate?: string;
    endDate?: string;
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    if (!companyId) return { success: false, error: "Unauthorized" };

    try {
        const where: any = { company_id: companyId };
        
        if (filters.accountId && filters.accountId !== 'ALL') {
            where.account_id = filters.accountId;
        }
        
        if (filters.partnerId && filters.partnerId !== 'ALL') {
            where.partner_id = filters.partnerId;
        }
        
        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) where.date.gte = new Date(filters.startDate);
            if (filters.endDate) where.date.lte = new Date(filters.endDate);
        }

        const entries = await prisma.journal_entry_lines.findMany({
            where,
            include: {
                accounts: {
                    select: { name: true, code: true }
                },
                journal_entries: {
                    select: { ref: true, journal_id: true, date: true }
                }
            },
            orderBy: [{ created_at: 'asc' }]
        });

        // Gather all partner IDs to query them in one batch
        const partnerIds = Array.from(new Set(entries.map(e => e.partner_id).filter((id): id is string => !!id)));
        const partners = partnerIds.length > 0
            ? await prisma.business_partners.findMany({
                where: { id: { in: partnerIds } }
            })
            : [];
        const partnerMap = new Map(partners.map(p => [p.id, p]));

        // Calculate Running Balance
        let runningBalance = 0;
        const data = entries.map(e => {
            const debit = Number(e.debit || 0);
            const credit = Number(e.credit || 0);
            runningBalance += (debit - credit);
            
            const partner = e.partner_id ? partnerMap.get(e.partner_id) : null;
            
            return {
                ...e,
                account_chart: e.accounts,
                partner: partner ? { name: partner.name } : null,
                journal_entry: e.journal_entries ? {
                    name: e.journal_entries.ref || '',
                    journal_id: e.journal_entries.journal_id || 'GENERAL',
                    date: e.journal_entries.date
                } : null,
                runningBalance
            };
        });

        return { success: true, data };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Fetches the chart of accounts for the filter dropdown.
 */
export async function getAccountList() {
    const session = await auth();
    const companyId = session?.user?.companyId;
    if (!companyId) return [];
    
    return await prisma.account_chart.findMany({
        where: { company_id: companyId },
        select: { id: true, name: true, code: true },
        orderBy: { code: 'asc' }
    });
}
