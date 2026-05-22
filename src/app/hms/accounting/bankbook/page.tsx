import { auth } from "@/auth"
import { DetailedLedgerReport } from "@/components/accounting/detailed-ledger-report"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Bankbook | Accounting Oversight",
    description: "Bank account ledger and reconciliation register",
}

export default async function BankbookPage() {
    const session = await auth();
    return (
        <DetailedLedgerReport
            type="bankbook"
            currencyCode={session?.user?.currencyCode || 'INR'}
            currencySymbol={session?.user?.currencySymbol || '\u20B9'}
        />
    )
}
