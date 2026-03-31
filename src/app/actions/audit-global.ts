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
            include: {
                app_user: {
                    select: { name: true }
                }
            },
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { created_at: 'desc' }
        });

        const total = await prisma.audit_log.count({
            where: { tenant_id: session.user.tenantId }
        });

        // Basic serialization
        return {
            success: true,
            data: JSON.parse(JSON.stringify(logs)),
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
