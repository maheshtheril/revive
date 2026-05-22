'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

// --- COMPANIES ---

export async function getCompanies() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return prisma.company.findMany({
        where: { tenant_id: session.user.tenantId, enabled: true },
        orderBy: { created_at: 'asc' }
    })
}

// --- PIPELINES ---

export async function getPipelines(includeStages = false) {
    const session = await auth()
    const tid = (session?.user as any)?.tenantId || (session?.user as any)?.tenant_id;
    if (!tid) return []

    let pipelines = await prisma.crm_pipelines.findMany({
        where: { tenant_id: tid, deleted_at: null },
        include: {
            stages: includeStages ? {
                orderBy: { sort_order: 'asc' },
                where: { deleted_at: null }
            } : false
        },
        orderBy: { created_at: 'asc' }
    })

    // SELF-HEALING: If no pipelines exist, create a default one
    if (pipelines.length === 0) {
        console.log(`[CRM] Auto-seeding pipeline for tenant ${tid}`);
        const newPipe = await prisma.crm_pipelines.create({
            data: {
                tenant_id: tid,
                name: 'Sales Pipeline',
                is_default: true,
                stages: {
                    create: [
                        { name: 'Fresh Lead', sort_order: 10, probability: 10 },
                        { name: 'Qualified', sort_order: 20, probability: 30 },
                        { name: 'Proposal', sort_order: 30, probability: 60 },
                        { name: 'Negotiation', sort_order: 40, probability: 80 },
                        { name: 'Won', sort_order: 50, probability: 100 },
                        { name: 'Lost', sort_order: 60, probability: 0 }
                    ]
                }
            },
            include: {
                stages: includeStages ? {
                    orderBy: { sort_order: 'asc' },
                    where: { deleted_at: null }
                } : false
            }
        });
        pipelines = [newPipe];
    }

    // Serialize Decimals for Client Components
    return pipelines.map((p: any) => ({
        ...p,
        stages: p.stages?.map((s: any) => ({
            ...s,
            probability: s.probability ? Number(s.probability) : 0
        })) || []
    }))
}

export async function upsertPipeline(data: { id?: string, name: string, is_default?: boolean }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await prisma.crm_pipelines.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name, is_default: data.is_default }
            })
        } else {
            await prisma.crm_pipelines.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name,
                    is_default: data.is_default
                }
            })
        }
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to save pipeline" }
    }
}

export async function deletePipeline(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await prisma.crm_pipelines.update({
            where: { id, tenant_id: session.user.tenantId },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete" }
    }
}

// --- STAGES ---

export async function upsertStage(data: { id?: string, pipeline_id: string, name: string, type: string, probability?: number, sort_order: number }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await prisma.crm_stages.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    type: data.type,
                    probability: data.probability,
                    sort_order: data.sort_order
                }
            })
        } else {
            await prisma.crm_stages.create({
                data: {
                    pipeline_id: data.pipeline_id,
                    name: data.name,
                    type: data.type,
                    probability: data.probability || 0,
                    sort_order: data.sort_order
                }
            })
        }
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Failed to save stage" }
    }
}

export async function deleteStage(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await prisma.crm_stages.update({
            where: { id },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete stage" }
    }
}

// --- SOURCES ---

export async function getSources() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return prisma.crm_sources.findMany({
        where: { tenant_id: session.user.tenantId, deleted_at: null },
        orderBy: { name: 'asc' }
    })
}

export async function upsertSource(data: { id?: string, name: string }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await prisma.crm_sources.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name }
            })
        } else {
            await prisma.crm_sources.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name
                }
            })
        }
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to save source" }
    }
}

export async function deleteSource(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await prisma.crm_sources.update({
            where: { id, tenant_id: session.user.tenantId },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete source" }
    }
}

// --- INDUSTRIES ---

export async function getIndustries() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return prisma.lead_industry.findMany({
        where: { tenant_id: session.user.tenantId, deleted_at: null },
        orderBy: { name: 'asc' }
    })
}

export async function upsertIndustry(data: { id?: string, name: string, description?: string }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await prisma.lead_industry.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name, description: data.description }
            })
        } else {
            await prisma.lead_industry.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name,
                    description: data.description,
                    is_active: true
                }
            })
        }
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to save industry" }
    }
}

export async function deleteIndustry(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await prisma.lead_industry.update({
            where: { id, tenant_id: session.user.tenantId },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete industry" }
    }
}

// --- LOST REASONS ---

export async function getLostReasons() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return (prisma as any).crm_lost_reasons.findMany({
        where: { tenant_id: session.user.tenantId, deleted_at: null },
        orderBy: { name: 'asc' }
    })

}

export async function upsertLostReason(data: { id?: string, name: string, description?: string }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await (prisma as any).crm_lost_reasons.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name, description: data.description }
            })
        } else {
            await (prisma as any).crm_lost_reasons.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name,
                    description: data.description,
                    is_active: true
                }
            })
        }
        revalidatePath('/settings/crm')
        return { success: true }
    } catch (e) {
        return { error: "Failed to save lost reason" }
    }
}

export async function deleteLostReason(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await prisma.crm_lost_reasons.update({
            where: { id, tenant_id: session.user.tenantId },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete lost reason" }
    }
}

// --- CONTACT ROLES ---

export async function getContactRoles() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return (prisma as any).crm_contact_roles.findMany({
        where: { tenant_id: session.user.tenantId, deleted_at: null },
        orderBy: { name: 'asc' }
    })
}

export async function upsertContactRole(data: { id?: string, name: string, description?: string }) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        if (data.id) {
            await (prisma as any).crm_contact_roles.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name, description: data.description }
            })
        } else {
            await (prisma as any).crm_contact_roles.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name,
                    description: data.description,
                    is_active: true
                }
            })
        }
        revalidatePath('/settings/crm')
        return { success: true }
    } catch (e) {
        return { error: "Failed to save contact role" }
    }
}

export async function deleteContactRole(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: "Unauthorized" }

    try {
        await (prisma as any).crm_contact_roles.update({
            where: { id, tenant_id: session.user.tenantId },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/settings/crm')
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete contact role" }
    }
}
// --- USERS ---

export async function getCRMUsers() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return prisma.app_user.findMany({
        where: { tenant_id: session.user.tenantId, is_active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
    })
}
// --- TARGET TYPES ---

export async function getTargetTypes() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    return (prisma as any).crm_target_types.findMany({
        where: { tenant_id: session.user.tenantId, deleted_at: null },
        orderBy: { name: 'asc' }
    })
}

export async function upsertTargetType(data: { id?: string, name: string, description?: string }) {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.tenantId) return { error: "Unauthorized" }

    // Role-based Access Control
    const userRole = await prisma.app_user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
    });
    const role = userRole?.role || '';
    const isManager = session.user.isAdmin || role.toLowerCase().includes('admin') || role.toLowerCase().includes('manager');

    if (!isManager) {
        return { error: "Access Denied: Only administrators can define target categories." };
    }

    try {
        let result;
        if (data.id) {
            result = await (prisma as any).crm_target_types.update({
                where: { id: data.id, tenant_id: session.user.tenantId },
                data: { name: data.name, description: data.description }
            })
        } else {
            result = await (prisma as any).crm_target_types.create({
                data: {
                    tenant_id: session.user.tenantId,
                    name: data.name,
                    description: data.description
                }
            })
        }
        revalidatePath('/settings/crm')
        revalidatePath('/crm/leads/new')
        return { success: true, data: result }
    } catch (e) {
        return { error: "Failed to save target type" }
    }
}
