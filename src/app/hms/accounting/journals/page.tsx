'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJournalEntries } from '@/app/actions/accounting/journals';
import {
    Plus, Search, CheckCircle2, CircleDashed,
    FileText, BookOpen, TrendingUp, ArrowLeft,
    Calendar, Layers, ArrowRightLeft, ShieldCheck, Wallet, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export default function JournalsPage() {
    const router = useRouter();
    const [entries, setEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const res = await getJournalEntries();
        if (res?.success) {
            setEntries(res.data || []);
        }
        setIsLoading(false);
    }

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === 'F5') {
                e.preventDefault();
                router.push('/hms/accounting/payments/new');
            }
            if (e.key === 'F6') {
                e.preventDefault();
                router.push('/hms/accounting/receipts/new');
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [router]);

    const filtered = entries.filter(e =>
        e.ref?.toLowerCase().includes(search.toLowerCase()) ||
        e.journal_entry_lines?.some((l: any) =>
            l.description?.toLowerCase().includes(search.toLowerCase()) ||
            l.accounts?.name?.toLowerCase().includes(search.toLowerCase())
        )
    );

    const totalVolume = filtered.reduce((sum, e) => {
        const entryTotal = e.journal_entry_lines?.reduce((ls: number, line: any) => ls + Number(line.debit || 0), 0);
        return sum + entryTotal;
    }, 0);

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
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

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
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                                    Live Sync Node
                                </span>
                                <span className="text-xs text-slate-400 font-mono">FY 2025-2026</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white italic">General Ledger & <span className="text-indigo-400">Journal Register</span></h1>
                            <p className="text-xs text-slate-300 font-medium">System Integrated Double-Entry Financial Adjustment & Transaction Hub</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            onClick={() => router.push('/hms/accounting/payments/new')}
                            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Wallet className="h-4 w-4" />
                            + New Payment (F5)
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
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Total Register Volume</span>
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">₹{totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <BookOpen className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Ledger Nodes</span>
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">{filtered.length} Recorded Entries</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-teal-500/10 transition-colors" />
                        <div className="h-14 w-14 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Audit Status</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100% Balanced & Active</span>
                        </div>
                    </div>
                </div>

                {/* Filter / Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-4 px-6 shadow-sm">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Search by Reference ID, Account Name, Description..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-11 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl font-medium text-sm focus-visible:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>Showing {filtered.length} matching transactions</span>
                    </div>
                </div>

                {/* Entries Stream */}
                <div className="flex-1 space-y-6 pb-12">
                    {isLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/50">
                            <CircleDashed className="h-10 w-10 text-indigo-600 animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">Loading Financial Ledger Entries...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/50 text-slate-400">
                            <BookOpen className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                            <span className="text-xs font-black uppercase tracking-widest block">No Transactions Found</span>
                            <span className="text-xs text-slate-400">Try adjusting your search filter keywords</span>
                        </div>
                    ) : (
                        filtered.map((entry: any) => (
                            <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-6 overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                <span>{entry.ref || 'AUTO-JOURNAL'}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 font-medium">{safeFormat(entry.date, 'eeee, dd MMMM yyyy')}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border",
                                            entry.posted
                                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60"
                                                : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900/60"
                                        )}>
                                            {entry.posted ? 'Posted / Verified' : 'Draft Voucher'}
                                        </span>
                                    </div>
                                </div>

                                {/* Line Items Table */}
                                <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 font-black uppercase tracking-widest text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                                            <tr>
                                                <th className="px-6 py-3.5 w-12 text-center">#</th>
                                                <th className="px-6 py-3.5">Particulars / Account</th>
                                                <th className="px-6 py-3.5">Narration / Details</th>
                                                <th className="px-6 py-3.5 text-right w-36">Debit</th>
                                                <th className="px-6 py-3.5 text-right w-36">Credit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                                            {entry.journal_entry_lines?.map((line: any, idx: number) => (
                                                <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{line.accounts?.name}</div>
                                                        <div className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">GL Code: {line.accounts?.code}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 italic">
                                                        {line.description || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-sm text-slate-900 dark:text-white">
                                                        {Number(line.debit) > 0 ? `₹${Number(line.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-sm text-slate-900 dark:text-white">
                                                        {Number(line.credit) > 0 ? `₹${Number(line.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Summary Total Row */}
                                            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-800 font-mono font-black text-sm text-slate-900 dark:text-white">
                                                <td colSpan={3} className="px-6 py-4 text-right text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-sans font-bold">Balanced Voucher Total :</td>
                                                <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400">
                                                    ₹{entry.journal_entry_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400">
                                                    ₹{entry.journal_entry_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
