'use client';

import React from 'react';
import { PaymentVoucherForm } from "@/components/accounting/payment-voucher-form";

interface ExpenseDialogProps {
    onClose: () => void;
    headerActions?: React.ReactNode;
}

export function ExpenseDialog({ onClose, headerActions }: ExpenseDialogProps) {
    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col">
            <PaymentVoucherForm
                onClose={onClose}
                onSuccess={onClose}
                className="h-full"
                simplified={true}
                headerActions={headerActions}
            />
        </div>
    );
}
