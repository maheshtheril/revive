'use client';

import { Suspense } from 'react';
import { FinancialDashboard } from '@/components/accounting/financial-dashboard';

export default function BalanceSheetPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Balance Sheet...</div>}>
            {/* FORCE CLASSIC BALANCE SHEET VIEW AS MASTER ROOT PAGE */}
            <FinancialDashboard 
                defaultView="classic" 
                defaultTab="bs" 
                hideDashboardHeader={true} // [ELEVATION] HIDE THE TABS TO MAKE IT A PURE INDIVIDUAL PAGE
                hideSecondaryTabs={true}
                titleOverride="Statement of Financial Position"
            />
        </Suspense>
    );
}
