'use client';

import { useEffect, useState } from 'react';
import { getTrialBalance } from '@/app/actions/accounting/reports';
import { Printer, Calendar, RefreshCcw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function TrialBalancePage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [asOfDate]);

    async function loadData() {
        setIsLoading(true);
        const res = await getTrialBalance(new Date(asOfDate));
        if (res?.success) {
            setData(res);
        }
        setIsLoading(false);
    }

    const filtered = data?.data?.filter((item: any) => 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const val = (num: number) => num === 0 ? '' : num.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">TRIAL BALANCE</span>
                    <span className="text-[#ffffcc]">Ziona HMS v4.5</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Financial Year: 2025-26</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-1 p-1">
                {/* Left Side: Report Content */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col">
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080] no-print">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black uppercase">Trial Balance</span>
                            <div className="flex items-center gap-2 text-[10px] bg-[#002b2b] px-3 py-1 border border-[#008080]">
                                <Calendar className="h-3 w-3 text-[#64ffff]" />
                                <input 
                                    type="date" 
                                    value={asOfDate} 
                                    onChange={(e) => setAsOfDate(e.target.value)}
                                    className="bg-transparent text-white outline-none [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#64ffff]" />
                                <input 
                                    type="text" 
                                    placeholder="Search Ledger..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="h-7 pl-7 pr-4 bg-[#002b2b] border border-[#008080] rounded text-[10px] text-white focus:outline-none"
                                />
                            </div>
                            <button onClick={() => window.print()} className="h-7 px-4 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[10px] font-black flex items-center gap-2 transition-all">
                                <Printer className="h-3 w-3" /> PRINT
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 bg-[#002b2b]">
                        <table className="w-full text-left text-[11px] border-collapse border border-[#006666]">
                            <thead>
                                <tr className="bg-[#003333] text-[#64ffff] font-black border-b border-[#006666]">
                                    <th className="px-4 py-2 border-r border-[#006666]">Particulars</th>
                                    <th className="px-4 py-2 border-r border-[#006666] text-right w-48">Debit</th>
                                    <th className="px-4 py-2 text-right w-48 pr-8">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#003333]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={3} className="py-20 text-center text-[#64ffff] animate-pulse">
                                            CALCULATING LEDGER BALANCES...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-20 text-center text-[#64ffff]/40">
                                            NO DATA FOUND
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {filtered.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-[#003333] transition-colors group">
                                                <td className="px-4 py-1 border-r border-[#006666]">
                                                    <span className="text-white group-hover:text-[#64ffff]">{item.name.toUpperCase()}</span>
                                                </td>
                                                <td className="px-4 py-1 border-r border-[#006666] text-right text-emerald-400">
                                                    {val(item.debit)}
                                                </td>
                                                <td className="px-4 py-1 text-right text-rose-400 pr-8">
                                                    {val(item.credit)}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Grand Totals */}
                                        <tr className="bg-[#003333] font-black border-t-2 border-[#008080]">
                                            <td className="px-4 py-2 border-r border-[#006666] text-[#64ffff]">
                                                GRAND TOTAL
                                            </td>
                                            <td className="px-4 py-2 border-r border-[#006666] text-right text-white">
                                                {val(data?.totalDebit)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-white pr-8">
                                                {val(data?.totalCredit)}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Interaction Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[10px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff]">STATUS: {data?.totalDebit === data?.totalCredit ? 'BALANCED' : 'OUT OF BALANCE'}</span>
                            <span className="text-[#64ffff]">NODES: {filtered.length}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-white">F12: CONFIGURE</span>
                        </div>
                    </div>
                </div>

                {/* Right Side Shortcuts */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1 no-print">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666] mb-2">
                        <span className="text-[12px] font-black text-[#ffffcc]">CLASSIC ERP GATEWAY</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp' },
                            { f: 'F2', l: 'Period' },
                            { f: 'F5', l: 'Ledger-wise' },
                            { f: 'F10', l: 'Balance Sheet' },
                            { f: 'F12', l: 'Configure' },
                        ].map(btn => (
                            <button key={btn.f} className="w-full h-8 flex items-center px-2 text-[10px] text-white hover:bg-[#004d4d] border border-transparent hover:border-[#008080] transition-all">
                                <span className="w-8 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left uppercase">{btn.l}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
