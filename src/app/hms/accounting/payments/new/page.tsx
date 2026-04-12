'use client';

import { useRouter } from 'next/navigation';
import { TallyPaymentForm } from '@/components/accounting/tally-voucher-form';
import { upsertPayment } from '@/app/actions/accounting/payments';
import { searchSuppliers, getOutstandingPurchaseBills, searchJournals } from '@/app/actions/accounting/helpers';
import { getAccounts } from '@/app/actions/accounting/chart-of-accounts';

export default function NewPaymentPage() {
    const router = useRouter();

    const handleSave = async (payload: any) => {
        const res = await upsertPayment(payload);
        if (res.error) return false;
        return true;
    };

    return (
        <div className="h-screen w-full bg-[#003333]">
            <TallyPaymentForm
                type="payment"
                onSave={handleSave}
                onCancel={() => router.back()}
                suppliersSearch={searchSuppliers}
                accountsSearch={async (q) => {
                  const res = await getAccounts(q);
                  return res.success ? res.data : [];
                }}
                journalsSearch={searchJournals}
                getBills={getOutstandingPurchaseBills}
                currency="₹"
            />
        </div>
    );
}
