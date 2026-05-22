'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPayments } from '@/app/actions/accounting/payments';
import { Search, ArrowLeft, Wallet, Receipt, Layers, ShieldCheck, Calendar, CircleDashed, Plus, CheckCircle2, TrendingDown, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function PaymentsPage() {
    const router = useRouter();
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD
    const [activeTab, setActiveTab] = useState<'ALL' | 'VENDOR' | 'EXPENSE'>('ALL');

    useEffect(() => {
        loadData();
    }, [dateFilter]);

    async function loadData() {
        setIsLoading(true);
        const res = await getPayments('outbound', undefined, dateFilter || undefined);
        if (res?.success) {
            setPayments(res.data || []);
        }
        setIsLoading(false);
    }

    const filtered = payments.filter(p => {
        const matchesSearch =
            p.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
            p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.reference?.toLowerCase().includes(search.toLowerCase());

        if (!matchesSearch) return false;

        const meta = p.metadata as any;
        const isVendor = !!p.partner_id || (meta?.allocations && meta.allocations.length > 0);

        if (activeTab === 'VENDOR') return isVendor;
        if (activeTab === 'EXPENSE') return !isVendor;

        return true;
    });

    const totalPaid = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
    const countPosted = filtered.filter(p => p.posted).length;

    const safeFormat = (date: any, fmt: string) => {
        try {
            if (!date) return 'N/A';
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'N/A';
            return format(d, fmt);
        } catch (e) {
            return 'N/A';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-indigo-500/20">
            {/* Top Navigation / Hero Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-8 py-8 border-b border-indigo-500/20 shadow-xl shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-12 w-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                                    Outbound Cash Flow Hub
                                </span>
                                <span className="text-xs text-slate-400 font-mono">FY 2025-2026</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white italic">Enterprise Outbound <span className="text-amber-400">Expense Register</span></h1>
                            <p className="text-xs text-slate-300 font-medium">System Integrated Double-Entry Accounts Payable & Petty Cash Ledger</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            onClick={() => router.push('/hms/accounting/payments/new')}
                            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Wallet className="h-4 w-4" />
                            + New Payment / Exp (F5)
                        </Button>
                        <Button
                            onClick={() => router.push('/hms/accounting/receipts/new')}
                            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Receipt className="h-4 w-4" />
                            + New Receipt (F6)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-8 py-8 flex flex-col gap-8">
                {/* Metrics Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <TrendingDown className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Total Register Outflow</span>
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Vouchers Recorded</span>
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">{filtered.length} Dispatched</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Posted & Verified</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{countPosted} Vouchers</span>
                        </div>
                    </div>
                </div>

                {/* Filter / Search Bar */}
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-4 px-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search voucher #, payee, reference..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-11 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl font-medium text-sm focus-visible:ring-indigo-500"
                            />
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 w-full sm:w-auto">
                            {[
                                { id: 'ALL', label: 'All Records' },
                                { id: 'VENDOR', label: 'Vendor Settlements' },
                                { id: 'EXPENSE', label: 'Petty Cash / Exp' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex-1 sm:flex-none",
                                        activeTab === tab.id
                                            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        <div className="relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 h-11">
                            <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                            <input
                                type="date"
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    className="ml-2 text-xs text-rose-500 hover:underline font-bold"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Stream */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-600" />
                            Voucher Execution Stream
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">Showing precisely {filtered.length} matching transactions</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 w-36">Voucher Date</th>
                                    <th className="px-6 py-4 w-44">Voucher No.</th>
                                    <th className="px-6 py-4">Particulars / Payee</th>
                                    <th className="px-6 py-4 w-44">Category Type</th>
                                    <th className="px-6 py-4 text-right w-44 pr-8">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                <CircleDashed className="h-8 w-8 text-amber-600 animate-spin" />
                                                <span className="text-xs font-black uppercase tracking-widest animate-pulse">Synchronizing Outbound Vouchers...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                <Wallet className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                                                <span className="text-xs font-black uppercase tracking-widest block">No Outbound Records Found</span>
                                                <span className="text-xs text-slate-400">Try clearing or adjusting your search keyword filters</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((p) => {
                                        const meta = p.metadata as any;
                                        const isVendor = !!p.partner_id || (meta?.allocations && meta.allocations.length > 0);
                                        const typeLabel = isVendor ? 'Vendor Bill Settlement' : (meta?.category_name || 'Petty Cash / Expense');

                                        return (
                                            <tr
                                                key={p.id}
                                                onClick={() => router.push(`/hms/accounting/payments/${p.id}/edit`)}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-6 py-5 text-xs text-slate-500 dark:text-slate-400 font-bold font-mono">
                                                    {safeFormat(p.date || p.created_at, 'dd MMM yyyy').toUpperCase()}
                                                </td>
                                                <td className="px-6 py-5 font-mono font-bold text-slate-900 dark:text-white">
                                                    <span className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                        {p.payment_number}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="font-bold text-slate-900 dark:text-white text-base leading-tight mb-0.5">
                                                        {p.partner_name?.toUpperCase() || meta?.payee_name?.toUpperCase() || 'CASH GENERAL EXPENSE'}
                                                    </div>
                                                    {p.reference && (
                                                        <div className="text-xs text-slate-400 font-mono tracking-wide">
                                                            Ref: {p.reference}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={cn(
                                                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                        isVendor
                                                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/80"
                                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/80"
                                                    )}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono font-black text-base text-slate-900 dark:text-white pr-8">
                                                    ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-6">
                            <span>Total Vouchers: <strong className="text-slate-900 dark:text-white font-mono">{filtered.length}</strong></span>
                            <span>Posted Verification: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{countPosted}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Enterprise Financial Sync Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
