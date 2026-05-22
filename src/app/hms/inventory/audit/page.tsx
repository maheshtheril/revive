import { MobileAuditClient } from "@/components/inventory/mobile-audit-client";
import { getCategories, getUOMs } from "@/app/actions/inventory";

export const metadata = {
    title: "Godown Audit Terminal | Cloud Inventory",
    description: "World-class high-speed mobile stock onboarding and physical audit system."
};

export default async function AuditPage() {
    // Fetch categories and UOMs for the audit point
    const [categories, uoms] = await Promise.all([
        getCategories(),
        getUOMs()
    ]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black">
            {/* Force Refresh Node v2 */}
            <MobileAuditClient categories={categories} uoms={uoms as any[]} />
        </div>
    );
}
