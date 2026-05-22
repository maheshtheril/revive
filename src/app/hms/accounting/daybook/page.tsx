import { auth } from "@/auth"
import { DetailedLedgerReport } from "@/components/accounting/detailed-ledger-report"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Daybook | Accounting Oversight",
    description: "Daily transaction register and audit log",
}

export default async function DaybookPage() {
    const session = await auth();
    return (
        <DetailedLedgerReport
            type="daybook"
            currencyCode={session?.user?.currencyCode || 'INR'}
            currencySymbol={session?.user?.currencySymbol || '\u20B9'}
        />
    )
}
