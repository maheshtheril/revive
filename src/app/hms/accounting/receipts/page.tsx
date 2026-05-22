'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPayments } from '@/app/actions/accounting/payments';
import {
    Plus, Search, CheckCircle2, CircleDashed,
    FileText, ArrowDownLeft, TrendingUp, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { CreateReceiptDialog } from '@/components/accounting/create-receipt-dialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceiptsPage() {
    const router = useRouter();
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const res = await getPayments('inbound');
        if (res?.success) {
            setPayments(res.data || []);
        }
        setIsLoading(false);
    }

    const filtered = payments.filter(p =>
        p.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(search.toLowerCase())
    );

    const totalReceipts = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
    const countDraft = filtered.filter(p => !p.posted).length;
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
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">RECEIPT REGISTER</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Financial Year: 2025-26</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-1 p-1">
                {/* Left Side: Receipt List */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col">
                    <div className="h-8 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080]">
                        <span className="text-[12px] font-black">LIST OF RECEIPTS</span>
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#64ffff]" />
                                <input
                                    type="text"
                                    placeholder="SEARCH..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="h-5 pl-7 pr-2 bg-[#002b2b] border border-[#008080] rounded text-[10px] text-[#ffffcc] focus:outline-none focus:border-[#64ffff] w-48 transition-all"
                                />
                            </div>
                            <span className="text-[10px] text-white">F2: PERIOD | F12: CONFIGURE</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="bg-[#003333] text-[#64ffff] font-black border-b border-[#006666]">
                                    <th className="px-4 py-2 border-r border-[#006666] w-24">Date</th>
                                    <th className="px-4 py-2 border-r border-[#006666] w-32">Voucher No.</th>
                                    <th className="px-4 py-2 border-r border-[#006666]">Particulars</th>
                                    <th className="px-4 py-2 border-r border-[#006666] w-32">Method</th>
                                    <th className="px-4 py-2 text-right w-32 pr-8">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#003333]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-[#64ffff] animate-pulse uppercase tracking-[0.2em] text-[10px]">
                                            Syncing with ledger node...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-[#64ffff]/40 uppercase tracking-[0.2em] text-[10px]">
                                            No receipts found in this period
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((p) => (
                                        <tr 
                                            key={p.id} 
                                            onClick={() => router.push(`/hms/accounting/receipts/${p.id}/edit`)}
                                            className="hover:bg-[#002b2b] cursor-pointer group border-b border-[#006666]"
                                        >
                                            <td className="px-4 py-2 border-r border-[#006666]">{safeFormat(p.date, 'dd-MMM-yyyy').toUpperCase()}</td>
                                            <td className="px-4 py-2 border-r border-[#006666] font-bold">{p.payment_number}</td>
                                            <td className="px-4 py-2 border-r border-[#006666]">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[#ffffcc]">{p.partner_name?.toUpperCase() || 'ANONYMOUS'}</span>
                                                    {p.reference && <span className="text-[9px] text-[#64ffff]/60 uppercase tracking-tighter">{p.reference}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 border-r border-[#006666] uppercase text-[9px] font-bold text-[#64ffff]/80">{p.method}</td>
                                            <td className="px-4 py-2 text-right font-black text-[#ffffcc] pr-8">₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Stats Bar */}
                    <div className="h-10 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[10px] font-bold">
                        <div className="flex gap-8">
                            <div className="flex gap-2">
                                <span className="text-[#64ffff]">TOTAL COLLECTION:</span>
                                <span className="text-white">₹{totalReceipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[#64ffff]">VOUCHERS:</span>
                                <span>{filtered.length}</span>
                            </div>
                            <div className="flex gap-2 text-amber-500">
                                <span className="opacity-60">DRAFT:</span>
                                <span>{countDraft}</span>
                            </div>
                        </div>
                        <div className="flex gap-4 items-center">
                            <span className="text-[#64ffff] animate-pulse">SYSTEM LIVE SYNC</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Gateway Simulation */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666]">
                        <span className="text-[12px] font-black text-[#ffffcc]">GATEWAY of TALLY</span>
                        <div className="h-px w-full bg-[#006666] my-2" />
                        <span className="text-[10px] text-[#64ffff]">Voucher Options</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp', active: false },
                            { f: 'F2', l: 'Period', active: false },
                            { f: 'F4', l: 'Contra', active: false },
                            { f: 'F5', l: 'Payment', active: false },
                            { f: 'F6', l: 'Receipt', active: true },
                            { f: 'F7', l: 'Journal', active: false },
                            { f: 'F8', l: 'Sales', active: false },
                            { f: 'F9', l: 'Purchase', active: false },
                            { f: 'Alt+C', l: 'Create', active: false, onClick: () => router.push('/hms/accounting/receipts/new') },
                        ].map(btn => (
                            <button 
                                key={btn.f} 
                                onClick={btn.onClick}
                                className={`w-full flex items-center h-8 px-2 text-[10px] transition-all ${btn.active ? 'bg-[#ffffcc] text-black font-black' : 'hover:bg-[#004d4d] text-white'}`}
                            >
                                <span className="w-12 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left uppercase">{btn.l}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#004d4d] p-3 border border-[#006666]">
                        <p className="text-[8px] text-[#64ffff]/60 uppercase tracking-widest leading-relaxed">
                            Terminal: POS-77<br />
                            Session: Secure<br />
                            Auth: Admin
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

