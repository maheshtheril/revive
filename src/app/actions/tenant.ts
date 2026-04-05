'use server'

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getTenant() {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    try {
        const session = await auth();
        if (!session?.user?.id) return null;

        let tenantId = session?.user?.tenantId;

        // 1. Fallback: If session doesn't have it, lookup user from DB
        if (!tenantId) {
            if (!session.user.id || !uuidRegex.test(session.user.id)) {
                console.warn("[TENANT-ACTION] Skipping DB lookup: Invalid User ID format", session.user.id);
                return null;
            }

            const user = await prisma.app_user.findUnique({
                where: { id: session.user.id },
                select: { tenant_id: true }
            });
            tenantId = user?.tenant_id as string;
        }

        if (!tenantId) return null;

        if (!uuidRegex.test(tenantId)) {
            console.error("[TENANT-ACTION] Invalid Tenant ID format:", tenantId);
            return null;
        }

        // 3. Authority fetch
        if (!tenantId || !uuidRegex.test(tenantId)) {
            console.error("[TENANT-ACTION] Aborting fetch: Invalid Tenant ID format", tenantId);
            return null;
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        return tenant;
    } catch (error: any) {
        console.error("❌ [TENANT-ACTION] CRITICAL FAILURE:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        return null;
    }
}
