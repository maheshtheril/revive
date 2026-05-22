'use client';

import { useEffect, useState } from 'react';
import { getProfitAndLossStatement } from '@/app/actions/accounting/reports';
import { Printer, Calendar, RefreshCcw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ProfitAndLossPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    async function loadData() {
        setIsLoading(true);
        const res = await getProfitAndLossStatement(new Date(startDate), new Date(endDate));
        if (res?.success) {
            setData(res.data);
        }
        setIsLoading(false);
    }

    const val = (num: number) => num === 0 ? '' : Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const isNegative = (num: number) => num < 0;

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">PROFIT & LOSS A/C</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Enterprise Resource Planning</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-1 p-1 overflow-hidden">
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col overflow-hidden">
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080] no-print">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black uppercase">Profit & Loss Account</span>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-[#002b2b] px-2 py-1 border border-[#008080] rounded">
                                    <span className="text-[8px] opacity-50 mr-2 text-[#64ffff]">FROM</span>
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent text-[10px] text-white outline-none [color-scheme:dark] w-24"
                                    />
                                </div>
                                <div className="flex items-center bg-[#002b2b] px-2 py-1 border border-[#008080] rounded">
                                    <span className="text-[8px] opacity-50 mr-2 text-[#64ffff]">TO</span>
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent text-[10px] text-white outline-none [color-scheme:dark] w-24"
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
                                <h2 className="text-lg font-black tracking-widest">ZIONA MEDICAL HOSPITAL ENTERPRISE</h2>
                                <p className="text-[10px] opacity-70">PROFIT & LOSS ACCOUNT FOR THE PERIOD {format(new Date(startDate), 'dd-MMM-yyyy').toUpperCase()} TO {format(new Date(endDate), 'dd-MMM-yyyy').toUpperCase()}</p>
                            </div>

                            <div className="grid grid-cols-2">
                                {/* Left Side: Expenses / COGS */}
                                <div className="border-r border-[#006666] flex flex-col min-h-[400px]">
                                    <div className="bg-[#003333] px-4 py-1 flex justify-between border-b border-[#006666] font-black text-[#64ffff] text-[10px]">
                                        <span>PARTICULARS (EXPENSES)</span>
                                        <span>AMOUNT</span>
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px] flex-1">
                                        <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff]">
                                            <span>TRADING EXPENSES</span>
                                        </div>
                                        {data?.cogs?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between border-t border-[#004d4d] pt-1 font-bold mt-2">
                                            <span className="opacity-70 italic">Total Trading Cost (COGS)</span>
                                            <span>{val(data?.totalCOGS || 0)}</span>
                                        </div>

                                        <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff] mt-6">
                                            <span>OPERATING EXPENSES</span>
                                        </div>
                                        {data?.expenses?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                        {/* GROSS PROFIT C/O if positive (Tally style usually shows it on left if Trading is separated, but here we do single list) */}
                                    </div>
                                </div>

                                {/* Right Side: Revenue / Income */}
                                <div className="flex flex-col min-h-[400px]">
                                    <div className="bg-[#003333] px-4 py-1 flex justify-between border-b border-[#006666] font-black text-[#64ffff] text-[10px]">
                                        <span>PARTICULARS (INCOME)</span>
                                        <span>AMOUNT</span>
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px] flex-1">
                                         <div className="flex justify-between font-black border-b border-[#004d4d] pb-1 text-[#64ffff]">
                                            <span>REVENUE FROM OPERATIONS</span>
                                        </div>
                                        {data?.revenue?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-4 hover:bg-[#003333] cursor-pointer">
                                                <span>{item.name.toUpperCase()}</span>
                                                <span>{val(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Net Profit Bar */}
                            <div className="border-t-2 border-double border-[#008080] grid grid-cols-2 font-black text-[#ffffcc] text-[12px] bg-[#003333]/30">
                                <div className="border-r border-[#006666] p-4 flex justify-between">
                                    <span className={cn(data?.netProfit > 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {data?.netProfit > 0 ? "NET PROFIT (SURPLUS)" : "NET LOSS (DEFICIT)"}
                                    </span>
                                    <span className={cn(data?.netProfit > 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {val(data?.netProfit || 0)}
                                    </span>
                                </div>
                                <div className="p-4 flex justify-between text-[#64ffff]">
                                    <span>GRAND TOTAL</span>
                                    <span>{val(Math.max((data?.totalRevenue || 0), (data?.totalExpenses + data?.totalCOGS || 0) + (data?.netProfit > 0 ? data?.netProfit : 0)))}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interaction Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[10px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff]">STATUS: {isLoading ? 'CALCULATING...' : 'AUDITED'}</span>
                            <span className="text-[#64ffff]">MARGIN: {data?.totalRevenue ? ((data.netProfit / data.totalRevenue) * 100).toFixed(2) : '0.00'}%</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-white">F10: BALANCE SHEET</span>
                            <span className="text-white">F12: CONFIGURE</span>
                        </div>
                    </div>
                </div>

                {/* Right Side Shortcuts */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1 no-print">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666] mb-2">
                        <span className="text-[12px] font-black text-[#ffffcc]">ERP GATEWAY</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp' },
                            { f: 'F2', l: 'Period' },
                            { f: 'F10', l: 'Balance Sheet', href: '/hms/accounting/balance-sheet' },
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
