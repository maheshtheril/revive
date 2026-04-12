'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TallyPaymentForm } from '@/components/accounting/tally-voucher-form';
import { upsertPayment, getPayment } from '@/app/actions/accounting/payments';
import { 
    searchSuppliers, getOutstandingPurchaseBills, 
    searchJournals, searchAccounts 
} from '@/app/actions/accounting/helpers';
import { Loader2 } from 'lucide-react';

export default function EditPaymentPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [initialData, setInitialData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadPayment() {
            const res = await getPayment(id);
            if (res.success) {
                const p = res.data;
                const meta = p.metadata as any;
                
                // Map database record to editor format
                const formatted = {
                    id: p.id,
                    date: meta?.date ? meta.date.split('T')[0] : p.created_at?.split('T')[0],
                    amount: p.amount.toString(),
                    partner_id: p.partner_id,
                    reference: p.reference,
                    memo: meta?.memo || p.memo,
                    journalId: p.journal_id,
                    journalName: p.journalName,
                    partnerName: p.partnerName,
                    type: meta?.type || 'outbound',
                    voucherType: p.partner_id ? 'bill' : 'direct',
                    allocations: meta?.allocations || [],
                    lines: p.enrichedLines || []
                };
                setInitialData(formatted);
            } else {
                console.error("Failed to load payment:", res.error);
                router.push('/hms/accounting/payments');
            }
            setIsLoading(false);
        }
        loadPayment();
    }, [id, router]);

    const handleSave = async (payload: any) => {
        const res = await upsertPayment({ ...payload, id });
        if (res.error) return false;
        router.push('/hms/accounting/payments');
        return true;
    };

    if (isLoading) {
        return (
            <div className="h-screen w-full bg-[#003333] flex items-center justify-center text-[#64ffff] font-mono uppercase tracking-[0.3em]">
                <Loader2 className="h-8 w-8 animate-spin mr-4" />
                Retrieving Voucher Data...
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-[#003333]">
            <TallyPaymentForm
                type="payment"
                initialData={initialData}
                onSave={handleSave}
                onCancel={() => router.back()}
                suppliersSearch={searchSuppliers}
                accountsSearch={searchAccounts}
                journalsSearch={searchJournals}
                getBills={getOutstandingPurchaseBills}
                currency="₹"
            />
        </div>
    );
}
