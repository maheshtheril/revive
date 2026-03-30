import { auth } from "@/auth"
import { FinancialDashboard } from "@/components/accounting/financial-dashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Financial Dashboard | World Standard Accounting",
    description: "Daily accounting reports, P&L, and Balance Sheet",
}

export default async function AccountingDashboardPage({ searchParams }: { searchParams: any }) {
    const session = await auth();
    const params = await searchParams;

    return (
        <div className="flex-1 space-y-4">
            <FinancialDashboard
                currencyCode={session?.user?.currencyCode || 'INR'}
                currencySymbol={session?.user?.currencySymbol || '₹'}
                initialView={params.view === 'classic' ? 'classic' : 'modern'}
                initialTab={params.tab === 'bs' ? 'bs' : 'pl'}
            />
        </div>
    )
}
