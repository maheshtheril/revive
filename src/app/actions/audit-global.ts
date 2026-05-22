'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

/**
 * Fetch global system audit logs
 */
export async function getGlobalAuditLogs(page: number = 1, limit: number = 50) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const logs = await prisma.audit_log.findMany({
            where: {
                tenant_id: session.user.tenantId
            },
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { created_at: 'desc' }
        });

        // Fetch users manually since relation is not defined in Prisma schema
        const actorIds = Array.from(new Set(logs.map(l => l.actor_id).filter(Boolean))) as string[];
        const users = actorIds.length > 0 ? await prisma.app_user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true }
        }) : [];

        const userMap = new Map(users.map(u => [u.id, u]));

        const logsWithUser = logs.map(l => ({
            ...l,
            app_user: l.actor_id ? (userMap.get(l.actor_id) || null) : null
        }));

        const total = await prisma.audit_log.count({
            where: { tenant_id: session.user.tenantId }
        });

        // Basic serialization
        return {
            success: true,
            data: JSON.parse(JSON.stringify(logsWithUser)),
            total,
            pages: Math.ceil(total / limit)
        };
    } catch (err: any) {
        console.error("Global Audit Fetch Error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Record a manual audit entry
 */
export async function recordAuditEntry(event: string, tableName?: string, recordId?: string, operation?: string, diff?: any) {
    const session = await auth();
    if (!session?.user?.tenantId) return;

    try {
        await prisma.audit_log.create({
            data: {
                tenant_id: session.user.tenantId,
                actor_id: session.user.id,
                event,
                table_name: tableName,
                record_id: recordId,
                operation,
                diff: diff || {}
            }
        });
    } catch (err) {
        console.error("Audit Logging Failure:", err);
    }
}
