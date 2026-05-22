'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function getSyncStatus() {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // 1. Check Replication Slots (Local -> Cloud)
        const slots: any[] = await prisma.$queryRaw`
            SELECT slot_name, active, slot_type, active_pid
            FROM pg_replication_slots
        `;

        // 2. Check Active Replication Connections
        const replication: any[] = await prisma.$queryRaw`
            SELECT client_addr, state, 
                   sent_lsn::text, write_lsn::text, flush_lsn::text, replay_lsn::text
            FROM pg_stat_replication
        `;

        // 3. Last Local Transaction
        const lastTx: any[] = await prisma.$queryRaw`
            SELECT now() as current_time, pg_current_wal_lsn()::text as last_lsn
        `;

        const isActive = slots.some(s => s.active === true) || replication.length > 0;

        return {
            success: true,
            status: isActive ? 'online' : 'disconnected',
            details: {
                slots,
                connections: replication,
                serverTime: lastTx[0]?.current_time,
                lastLsn: lastTx[0]?.last_lsn
            }
        };
    } catch (error) {
        console.error("Sync Health Check Failed:", error);
        return {
            success: false,
            status: 'error',
            error: "Could not communicate with replication engine."
        };
    }
}

export async function triggerManualBackup() {
    // This is a placeholder for a more complex backup logic
    // For now, it just ensures the publication is up to date
    const session = await auth();
    if (!session?.user?.isAdmin) return { success: false, error: "Admin only" };

    try {
        await prisma.$executeRaw`ALTER PUBLICATION hms_cloud_publication ADD ALL TABLES`;
        return { success: true, message: "Sync Publication Refreshed." };
    } catch (error) {
        return { success: false, error: "Failed to refresh publication." };
    }
}
