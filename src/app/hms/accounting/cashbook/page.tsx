import { auth } from "@/auth"
import { DetailedLedgerReport } from "@/components/accounting/detailed-ledger-report"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Cashbook | Accounting Oversight",
    description: "Cash account ledger and balance tracking",
}

export default async function CashbookPage() {
    const session = await auth();
    return (
        <DetailedLedgerReport
            type="cashbook"
            currencyCode={session?.user?.currencyCode || 'INR'}
            currencySymbol={session?.user?.currencySymbol || '\u20B9'}
        />
    )
}
