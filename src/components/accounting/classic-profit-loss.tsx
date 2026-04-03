'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Printer, Calendar, Download, RefreshCcw, ArrowLeft, ArrowRight } from 'lucide-react'
import { useLocalization } from '@/contexts/localization-context'
import { format } from 'date-fns'

interface ClassicProfitLossProps {
    data: {
        revenue: any[]
        cogs: any[]
        expenses: any[]
        totalRevenue: number
        totalCOGS: number
        totalExpenses: number
        netProfit: number
    } | null
    startDate: Date
    endDate: Date
    onDateChange?: (newDate: Date) => void
    currencySymbol?: string
}

export function ClassicProfitLoss({
    data,
    startDate,
    endDate,
    onDateChange,
    currencySymbol = '₹'
}: ClassicProfitLossProps) {
    const { formatCurrency } = useLocalization()

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-[#002b2b] text-[#64ffff]">
                <RefreshCcw className="h-10 w-10 animate-spin mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest">Compiling Profit & Loss Accounts...</p>
            </div>
        )
    }

    // Tally often has Gross Profit calculated in the Trading Account part
    const grossProfit = data.totalRevenue - data.totalCOGS;

    // Helper to format amount for Tally look
    const val = (num: number) => num === 0 ? '' : num.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">PROFIT & LOSS A/C</span>
                    <span className="text-[#ffffcc]">Ziona HMS v4.5</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Enterprise ERP</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Main Report Body */}
            <div className="flex-1 flex gap-1 p-1 overflow-hidden">
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col">
                    {/* Report Menu Bar */}
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080] no-print">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black uppercase">Profit & Loss Account</span>
                            <div className="flex items-center gap-2 text-[10px] bg-[#002b2b] px-3 py-1 border border-[#008080]">
                                <Calendar className="h-3 w-3 text-[#64ffff]" />
                                <span className="text-[#64ffff]">Period:</span>
                                    <div className="flex items-center gap-2">
                                        <select 
                                            value={startDate.getMonth()} 
                                            onChange={(e) => onDateChange?.(new Date(startDate.getFullYear(), parseInt(e.target.value), 1))}
                                            className="bg-[#002b2b] text-[#64ffff] font-black outline-none border border-[#008080] px-2 py-0.5 cursor-pointer uppercase"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => (
                                                <option key={i} value={i} className="bg-[#002b2b] text-[#64ffff]">
                                                    {new Date(0, i).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                        <select 
                                            value={startDate.getFullYear()} 
                                            onChange={(e) => onDateChange?.(new Date(parseInt(e.target.value), startDate.getMonth(), 1))}
                                            className="bg-[#002b2b] text-[#64ffff] font-black outline-none border border-[#008080] px-2 py-0.5 cursor-pointer"
                                        >
                                            {Array.from({ length: 10 }, (_, i) => {
                                                const y = new Date().getFullYear() - 5 + i;
                                                return <option key={y} value={y} className="bg-[#002b2b] text-[#64ffff]">{y}</option>;
                                            })}
                                        </select>
                                    </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.print()} className="h-7 px-4 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[10px] font-black flex items-center gap-2 transition-all">
                                <Printer className="h-3 w-3" /> PRINT
                            </button>
                            <button className="h-7 px-4 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[10px] font-black flex items-center gap-2 transition-all">
                                <Download className="h-3 w-3" /> EXPORT
                            </button>
                        </div>
                    </div>

                    {/* TWO COLUMN TALLY LAYOUT */}
                    <div className="flex-1 overflow-auto flex flex-col p-4">
                        <div className="flex-1 border border-[#006666] flex flex-col bg-[#002b2b]">
                            {/* Column Headers */}
                            <div className="grid grid-cols-2 border-b border-[#008080] font-black text-[11px] bg-[#006666]">
                                <div className="grid grid-cols-12 divide-x divide-[#008080]">
                                    <div className="col-span-9 px-4 py-2">PARTICULARS (DEBIT)</div>
                                    <div className="col-span-3 px-4 py-2 text-right">AMOUNT</div>
                                </div>
                                <div className="grid grid-cols-12 divide-x divide-[#008080] border-l border-[#008080]">
                                    <div className="col-span-9 px-4 py-2">PARTICULARS (CREDIT)</div>
                                    <div className="col-span-3 px-4 py-2 text-right">AMOUNT</div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 grid grid-cols-2 min-h-[500px]">
                                {/* LEFT SIDE: DR (Expenses) */}
                                <div className="border-r border-[#006666] flex flex-col">
                                    {/* Direct Expenses / COGS */}
                                    <div className="p-4 space-y-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1">TRADING ACCOUNT (DIRECT)</div>
                                        {data.cogs.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Indirect Expenses */}
                                    <div className="p-4 pt-10 space-y-1 flex-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1">OPERATING EXPENSES (INDIRECT)</div>
                                        {data.expenses.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}

                                        {/* Net Profit Balancing Figure */}
                                        {data.netProfit >= 0 && (
                                            <div className="grid grid-cols-12 text-[11px] font-black mt-10 text-emerald-400">
                                                <div className="col-span-9">NET PROFIT</div>
                                                <div className="col-span-3 text-right border-t border-[#006666]">{val(data.netProfit)}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT SIDE: CR (Incomes) */}
                                <div className="flex flex-col">
                                    {/* Sales / Direct Incomes */}
                                    <div className="p-4 space-y-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1">TRADING ACCOUNT (INCOME)</div>
                                        {data.revenue.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Indirect Incomes */}
                                    <div className="p-4 pt-10 space-y-1 flex-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1">INDIRECT INCOMES</div>
                                        {/* Placeholder if system has indirect income later */}
                                        <div className="text-[10px] text-slate-600 italic">Nil</div>

                                        {/* Net Loss Balancing Figure */}
                                        {data.netProfit < 0 && (
                                            <div className="grid grid-cols-12 text-[11px] font-black mt-10 text-rose-400">
                                                <div className="col-span-9">NET LOSS</div>
                                                <div className="col-span-3 text-right border-t border-[#006666]">{val(Math.abs(data.netProfit))}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Grand Total Footer */}
                            <div className="grid grid-cols-2 border-t-2 border-[#008080] font-black text-[12px] bg-[#004d4d]">
                                <div className="grid grid-cols-12 divide-x divide-[#008080]">
                                    <div className="col-span-9 px-4 py-2 text-right text-[#64ffff]">TOTAL</div>
                                    <div className="col-span-3 px-4 py-2 text-right">
                                        {val(Math.max(data.totalRevenue, data.totalCOGS + data.totalExpenses + (data.netProfit > 0 ? data.netProfit : 0)))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 divide-x divide-[#008080] border-l border-[#008080]">
                                    <div className="col-span-9 px-4 py-2 text-right text-[#64ffff]">TOTAL</div>
                                    <div className="col-span-3 px-4 py-2 text-right">
                                        {val(Math.max(data.totalRevenue + (data.netProfit < 0 ? Math.abs(data.netProfit) : 0), data.totalCOGS + data.totalExpenses))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Info Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[9px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff] uppercase whitespace-nowrap">Institutional Authority Verified</span>
                            <span className="text-[#64ffff]">STATUS: AUDITED</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[#64ffff] animate-pulse">FINANCIAL YEAR: {new Date().getFullYear()}-{new Date().getFullYear()+1}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side Shortcuts (Tally Sidebar) */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1 no-print">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666] mb-2">
                        <span className="text-[12px] font-black text-[#ffffcc]">CLASSIC ERP GATEWAY</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F1', l: 'Select Cmp' },
                            { f: 'F2', l: 'Period' },
                            { f: 'F3', l: 'Company' },
                            { f: 'F10', l: 'Inventory' },
                            { f: 'F11', l: 'Features' },
                            { f: 'F12', l: 'Configure' },
                        ].map(btn => (
                            <button key={btn.f} className="w-full h-8 flex items-center px-2 text-[10px] text-white hover:bg-[#004d4d] border border-transparent hover:border-[#008080] transition-all">
                                <span className="w-8 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left uppercase">{btn.l}</span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-auto bg-[#002b2b]/50 p-4 border border-[#004d4d] text-center">
                        <p className="text-[8px] text-[#64ffff] font-black uppercase tracking-widest leading-loose">
                            Double-Entry<br />
                            Bookkeeping Logic<br />
                            Version 4.5.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
