'use client';

import { useEffect, useState } from 'react';
import { getBalanceSheetStatement } from '@/app/actions/accounting/reports';
import { Printer, Calendar, RefreshCcw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BalanceSheetPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [asOfDate]);

    async function loadData() {
        setIsLoading(true);
        const res = await getBalanceSheetStatement(new Date(asOfDate));
        if (res?.success) {
            setData(res.data);
        }
        setIsLoading(false);
    }

    const val = (num: number) => num === 0 ? '' : Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">BALANCE SHEET</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">As On Date Overview</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-1 p-1 overflow-hidden">
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col overflow-hidden">
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080] no-print">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black uppercase">Balance Sheet Register</span>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-[#002b2b] px-3 py-1 border border-[#008080] rounded">
                                    <span className="text-[8px] opacity-50 mr-2 text-[#64ffff]">AS AT</span>
                                    <input 
                                        type="date" 
                                        value={asOfDate} 
                                        onChange={(e) => setAsOfDate(e.target.value)}
                                        className="bg-transparent text-[10px] text-white outline-none [color-scheme:dark] w-32"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.print()} className="h-7 px-4 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[10px] font-black flex items-center gap-2 transition-all">
                                <Printer className="h-3 w-3 text-[#64ffff]" /> PRINT
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 bg-[#002b2b]">
                        <div className="max-w-6xl mx-auto border border-[#006666] bg-[#002b2b]">
                            {/* Company Header */}
                            <div className="text-center py-4 border-b border-[#006666]">
                                <h2 className="text-lg font-black tracking-widest uppercase">Ziona Global Medical Group</h2>
                                <p className="text-[10px] opacity-70 uppercase">Balance Sheet as on {format(new Date(asOfDate), 'dd-MMM-yyyy').toUpperCase()}</p>
                            </div>

                            <div className="grid grid-cols-2">
                                {/* Left Side: Liabilities & Equity (Sources of Funds) */}
                                <div className="border-r border-[#006666] flex flex-col min-h-[500px]">
                                    <div className="bg-[#003333] px-4 py-1 flex justify-between border-b border-[#006666] font-black text-[#64ffff] text-[10px]">
                                        <span>LIABILITIES & SOURCES OF FUNDS</span>
                                        <span>AMOUNT</span>
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px] flex-1">
                                        {/* Capital & Reserves */}
                                        <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff]">
                                            <span>EQUITY & RESERVES</span>
                                        </div>
                                        {data?.equity?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer text-emerald-400 font-bold border-t border-[#003333] mt-1 pt-1">
                                            <span>PROFIT & LOSS A/C (SURPLUS)</span>
                                            <span>{val(data?.retainedEarnings || 0)}</span>
                                        </div>

                                        {/* Current Liabilities */}
                                        <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff] mt-8">
                                            <span>CURRENT LIABILITIES (AP & OTHERS)</span>
                                        </div>
                                        {data?.liabilities?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Side: Assets (Application of Funds) */}
                                <div className="flex flex-col min-h-[500px]">
                                    <div className="bg-[#003333] px-4 py-1 flex justify-between border-b border-[#006666] font-black text-[#64ffff] text-[10px]">
                                        <span>ASSETS & APPLICATION OF FUNDS</span>
                                        <span>AMOUNT</span>
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px] flex-1">
                                         <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff]">
                                            <span>FIXED & CURRENT ASSETS</span>
                                        </div>
                                        {data?.assets?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Balance Sheet Totals Bar */}
                            <div className="border-t-2 border-double border-[#008080] grid grid-cols-2 font-black text-[#ffffcc] text-[12px] bg-[#003333]/30">
                                <div className="border-r border-[#006666] p-4 flex justify-between text-[#64ffff]">
                                    <span>TOTAL LIABILITIES</span>
                                    <span>{val(data?.totalLiabilities + data?.totalEquity || 0)}</span>
                                </div>
                                <div className="p-4 flex justify-between text-[#64ffff]">
                                    <span>TOTAL ASSETS</span>
                                    <span>{val(data?.totalAssets || 0)}</span>
                                </div>
                            </div>

                            {/* Out-of-balance check */}
                            {Math.abs((data?.totalLiabilities + data?.totalEquity) - data?.totalAssets) > 0.01 && (
                                <div className="bg-rose-900/50 p-2 text-center text-rose-300 text-[10px] font-black uppercase flex items-center justify-center gap-4">
                                    <div className="animate-pulse h-2 w-2 rounded-full bg-rose-500" />
                                    <span>Difference in Opening Balance: ₹{Math.abs((data?.totalLiabilities + data?.totalEquity) - data?.totalAssets).toLocaleString()}</span>
                                    <div className="animate-pulse h-2 w-2 rounded-full bg-rose-500" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Status Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[10px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff]">FY: 2025-26</span>
                            <span className="text-[#64ffff]">CURRENCY: INR (₹)</span>
                            <span className="text-[#64ffff]">NODES: { (data?.assets?.length || 0) + (data?.liabilities?.length || 0) + (data?.equity?.length || 0) } LEDGERS</span>
                        </div>
                        <div className="flex gap-4">
                            <span className={cn("px-2 rounded", (data?.totalLiabilities + data?.totalEquity === data?.totalAssets) ? "bg-emerald-900/40 text-emerald-400" : "bg-rose-900/40 text-rose-400")}>
                                { (data?.totalLiabilities + data?.totalEquity === data?.totalAssets) ? "BALANCED" : "SUSPENSE" }
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side Shortcuts */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1 no-print">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666] mb-2">
                        <span className="text-[12px] font-black text-[#ffffcc]">GATEWAY OF ZIONA</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp' },
                            { f: 'F2', l: 'Period' },
                            { f: 'F7', l: 'Profit & Loss', href: '/hms/accounting/profit-and-loss' },
                            { f: 'F12', l: 'Configure' },
                        ].map(btn => (
                            <Link key={btn.f} href={btn.href || '#'} className="w-full h-8 flex items-center px-2 text-[10px] text-white hover:bg-[#004d4d] border border-transparent hover:border-[#008080] transition-all">
                                <span className="w-8 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left uppercase">{btn.l}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
