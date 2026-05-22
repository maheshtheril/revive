'use server'

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getTenant() {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    try {
        const session = await auth();
        if (!session?.user?.id) {
            console.log("[TENANT-ACTION] No active session found");
            return null;
        }

        let tenantId = (session.user as any).tenantId;

        // 1. Fallback: If session doesn't have it, lookup user from DB
        if (!tenantId) {
            const userId = session.user.id;
            if (!userId || !uuidRegex.test(userId)) {
                console.warn("[TENANT-ACTION] Invalid User ID format for DB lookup:", userId);
                return null;
            }

            const user = await prisma.app_user.findUnique({
                where: { id: userId },
                select: { tenant_id: true }
            });
            tenantId = user?.tenant_id;
        }

        if (!tenantId || !uuidRegex.test(tenantId)) {
            console.warn("[TENANT-ACTION] Aborting fetch: Missing or invalid Tenant ID", tenantId);
            return null;
        }

        // 3. Final Authority fetch
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            const { redirect } = await import("next/navigation");
            redirect("/api/auth/signout");
        }

        return tenant;
    } catch (error: any) {
        // Log the actual error object properties to avoid stringifying to "{}"
        console.error("❌ [TENANT-ACTION] CRITICAL FAILURE:", {
            name: error?.name || "Unknown Error",
            message: error?.message || "Internal Server Trace Missing",
            digest: error?.digest // Next.js error digest
        });
        return null;
    }
}
export async function updateTenantNetworkSettings(url: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { error: "Unauthorized" };

        const tenantId = session?.user?.tenantId;
        if (!tenantId) return { error: "No Tenant associated with session" };

        await prisma.tenant.update({
            where: { id: tenantId },
            data: { app_url: url }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Failed to update network settings:", error);
        return { error: error.message };
    }
}
