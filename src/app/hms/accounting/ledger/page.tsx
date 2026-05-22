import { AccountLedger } from "@/components/accounting/account-ledger";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "General Ledger Hub | Accounting",
    description: "Detailed transaction history and account audit trail"
};

export default async function GeneralLedgerPage() {
    return (
        <div className="flex-1">
            <AccountLedger />
        </div>
    );
}
