'use client';

import { useRouter } from 'next/navigation';
import { PaymentVoucherForm } from '@/components/accounting/payment-voucher-form';

export default function NewPaymentPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
            <PaymentVoucherForm
                initialData={{}}
                onClose={() => router.back()}
                onSuccess={() => router.push('/hms/accounting/journals')}
            />
        </div>
    );
}
