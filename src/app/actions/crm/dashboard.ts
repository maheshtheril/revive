'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getCurrencySymbol, getCurrencyCode } from '@/lib/currency'

export async function getDashboardData() {
    const session = await auth()
    const user = session?.user

    // Authenticate and get Tenant
    // Note: Session user properties are camelCase as defined in auth.ts
    // @ts-ignore
    if (!user || !user.tenantId) {
        redirect('/login?reauth=1&callbackUrl=/crm/dashboard')
    }

    // @ts-ignore
    const tenantId = user.tenantId

    // Get Company & Currency Settings
    const companyRow = await prisma.company.findFirst({
        where: { tenant_id: tenantId }
    })

    let countryRow = null;
    if (companyRow?.country_id) {
        countryRow = await prisma.countries.findUnique({ where: { id: companyRow.country_id } });
    }

    // Default to US if not found, but we should probably use the utility
    // We import this dynamically or strictly
    const countryCode = countryRow?.iso2 || 'US'

    // 1. KPI: Total Revenue (Won Deals)
    const wonDeals = await prisma.crm_deals.findMany({
        where: {
            tenant_id: tenantId,
            status: 'won',
            deleted_at: null
        }
    })
    const totalRevenue = wonDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)

    // 2. KPI: Active Pipeline
    const activeDeals = await prisma.crm_deals.findMany({
        where: {
            tenant_id: tenantId,
            status: { notIn: ['won', 'lost'] },
            deleted_at: null
        }
    })
    const pipelineValue = activeDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)

    // 3. KPI: Avg Lead Score
    const leads = await prisma.crm_leads.findMany({
        where: { tenant_id: tenantId, deleted_at: null }
    })
    const avgLeadScore = leads.length > 0
        ? leads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / leads.length
        : 0

    // 4. FUNNEL: Deals by Stage
    const stages = await prisma.crm_stages.findMany({
        where: {
            // Assuming standard pipeline or all pipelines for aggregation
            pipeline: { tenant_id: tenantId }
        },
        include: {
            _count: {
                select: { deals: { where: { deleted_at: null } } }
            }
        },
        orderBy: { sort_order: 'asc' }
    })

    const funnelData = stages.map(s => ({
        id: s.id,
        name: s.name,
        count: s._count.deals,
        color: s.type === 'won' ? '#10B981' : s.type === 'lost' ? '#EF4444' : '#6366F1'
    }))

    // 5. ACTIVITY: Top Recent
    const recentActivities = await prisma.crm_activities.findMany({
        where: { tenant_id: tenantId, deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 5
    })

    // 6. HOT LEADS
    const hotLeads = await prisma.crm_leads.findMany({
        where: {
            tenant_id: tenantId,
            deleted_at: null,
            is_hot: true,
            status: { not: 'converted' } // Assuming converted leads are handled
        },
        orderBy: { lead_score: 'desc' },
        take: 5
    })

    return {
        kpis: {
            totalRevenue,
            pipelineValue,
            activeDealsCount: activeDeals.length,
            avgLeadScore: Math.round(avgLeadScore),
            winRate: 0 // TODO: Calculate if enough history
        },
        funnel: funnelData,
        activities: recentActivities,
        hotLeads,
        currencySymbol: getCurrencySymbol(countryCode),
        currencyCode: getCurrencyCode(countryCode)
    }
}
