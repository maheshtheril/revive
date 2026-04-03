'use client';

import { Suspense } from 'react';
import { FinancialDashboard } from '@/components/accounting/financial-dashboard';

export default function ProfitAndLossPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Master Statement...</div>}>
            {/* FORCE CLASSIC P&L VIEW AS MASTER ROOT PAGE */}
            <FinancialDashboard 
                initialView="classic" 
                initialTab="pl" 
                hideDashboardHeader={true} // [ELEVATION] HIDE THE TABS TO MAKE IT A PURE INDIVIDUAL PAGE
                hideSecondaryTabs={true}
                titleOverride="Profit & Loss Statement"
            />
        </Suspense>
    );
}
