'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPayments, deletePayment } from '@/app/actions/accounting/payments';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">PAYMENT REGISTER</span>
                    <span className="text-[#ffffcc]">Ziona HMS v4.5</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Financial Year: 2025-26</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-1 p-1">
                {/* Left Side: Payment List */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col">
                    <div className="h-8 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080]">
                        <span className="text-[12px] font-black">LIST OF PAYMENTS</span>
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
                            <button 
                                onClick={() => router.push('/hms/accounting/payments/new')}
                                className="h-5 px-3 bg-[#ffffcc] text-black font-black text-[9px] uppercase hover:bg-[#64ffff] transition-all flex items-center gap-1 shadow-lg"
                            >
                                <span className="text-[10px]">+</span> Add Entry
                            </button>
                            <span className="text-[10px] text-white">F2: PERIOD | F12: CONFIGURE</span>
                        </div>
                    </div>

                    {/* Tabs / Filter Bar */}
                    <div className="h-7 bg-[#003333] flex items-center px-2 gap-1 border-b border-[#006666]">
                        {['ALL', 'VENDOR', 'EXPENSE'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "px-4 h-5 text-[9px] font-black uppercase transition-all",
                                    activeTab === tab 
                                        ? "bg-[#ffffcc] text-black" 
                                        : "text-[#64ffff] hover:bg-[#004d4d]"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                        <div className="flex-1" />
                        <div className="flex items-center gap-2">
                             <input
                                type="date"
                                className="h-5 bg-[#002b2b] border border-[#006666] text-[9px] text-[#ffffcc] px-1 outline-none [color-scheme:dark]"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="bg-[#003333] text-[#64ffff] font-black border-b border-[#006666]">
                                    <th className="px-4 py-2 border-r border-[#006666] w-24">Date</th>
                                    <th className="px-4 py-2 border-r border-[#006666] w-32">Voucher No.</th>
                                    <th className="px-4 py-2 border-r border-[#006666]">Particulars</th>
                                    <th className="px-4 py-2 border-r border-[#006666] w-32">Type</th>
                                    <th className="px-4 py-2 text-right w-32 pr-8">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#003333]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-[#64ffff] animate-pulse uppercase tracking-[0.2em] text-[10px]">
                                            Loading accounting nodes...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-[#64ffff]/40 uppercase tracking-[0.2em] text-[10px]">
                                            No payment records found
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((p) => {
                                        const meta = p.metadata as any;
                                        const isVendor = !!p.partner_id || (meta?.allocations && meta.allocations.length > 0);
                                        const typeLabel = isVendor ? 'Vendor' : (meta?.category_name || 'Expense');
                                        
                                        return (
                                            <tr key={p.id} className="hover:bg-[#002b2b] cursor-pointer group border-b border-[#006666]">
                                                <td className="px-4 py-2 border-r border-[#006666]">{safeFormat(p.date || p.created_at, 'dd-MMM-yyyy').toUpperCase()}</td>
                                                <td className="px-4 py-2 border-r border-[#006666] font-bold">{p.payment_number}</td>
                                                <td className="px-4 py-2 border-r border-[#006666]">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[#ffffcc]">{p.partner_name?.toUpperCase() || meta?.payee_name?.toUpperCase() || 'CASH EXPENSE'}</span>
                                                        {p.reference && <span className="text-[9px] text-[#64ffff]/60 uppercase tracking-tighter">{p.reference}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 border-r border-[#006666]">
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase px-1.5 py-0.5 border",
                                                        isVendor ? "border-indigo-500/30 text-indigo-400" : "border-slate-500/30 text-slate-400"
                                                    )}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right font-black text-[#ffffcc] pr-8">₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Stats Bar */}
                    <div className="h-10 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[10px] font-bold">
                        <div className="flex gap-8">
                            <div className="flex gap-2">
                                <span className="text-[#64ffff]">TOTAL PAID:</span>
                                <span className="text-white">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[#64ffff]">VOUCHERS:</span>
                                <span>{filtered.length}</span>
                            </div>
                            <div className="flex gap-2 text-emerald-400">
                                <span className="opacity-60">POSTED:</span>
                                <span>{countPosted}</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[#64ffff] animate-pulse uppercase tracking-[0.2em]">Live Financial Node</span>
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
                            { f: 'F5', l: 'Payment', active: true, onClick: () => router.push('/hms/accounting/payments/new') },
                            { f: 'F6', l: 'Receipt', active: false },
                            { f: 'Alt+C', l: 'Create', active: false, onClick: () => router.push('/hms/accounting/payments/new') },
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
                            Terminal: T-01<br />
                            Identity: Confirmed<br />
                            Protocol: RPC-v2
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
