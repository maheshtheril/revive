import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * World Standard Date Helper
 * Returns the current date and time adjusted to the hospital's configured timezone.
 * Defaults to 'Asia/Kolkata' if not specified, ensuring IST compliance for India.
 * Accepts optional transaction client to prevent connection pool exhaustion deadlocks.
 */
export async function getHospitalNow(txClient: any = prisma): Promise<Date> {
    const session = await auth();
    const companyId = session?.user?.companyId;
    
    // Default fallback
    const DEFAULT_TIMEZONE = "Asia/Kolkata";

    if (!companyId) {
        return new Date(new Date().toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }));
    }

    try {
        const settings = await txClient.company_settings.findUnique({
            where: { company_id: companyId },
            select: { timezone: true }
        });

        const timezone = settings?.timezone || DEFAULT_TIMEZONE;
        
        // Accurate timezone conversion using Intl
        return new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    } catch (error) {
        console.error("Failed to fetch hospital timezone, falling back to IST:", error);
        return new Date(new Date().toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }));
    }
}

/**
 * Formats a date string for database persistence (YYYY-MM-DD)
 * adjusted for the hospital timezone.
 */
export async function getHospitalTodayString(txClient: any = prisma): Promise<string> {
    const now = await getHospitalNow(txClient);
    return now.toISOString().split('T')[0];
}
