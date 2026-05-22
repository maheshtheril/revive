'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Printer, Calendar, Download, RefreshCcw, ArrowLeft, ArrowRight, Landmark, Wallet } from 'lucide-react'
import { useLocalization } from '@/contexts/localization-context'
import { format } from 'date-fns'

interface ClassicBalanceSheetProps {
    data: {
        assets: any[]
        liabilities: any[]
        equity: any[]
        totalAssets: number
        totalLiabilities: number
        totalEquity: number
        retainedEarnings: number
    } | null
    date: Date
    currencySymbol?: string
}

export function ClassicBalanceSheet({
    data,
    date,
    currencySymbol = '\u20B9'
}: ClassicBalanceSheetProps) {
    const { formatCurrency } = useLocalization()

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-[#002b2b] text-[#64ffff]">
                <RefreshCcw className="h-10 w-10 animate-spin mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest">Reconstructing Balance Sheet Ledger...</p>
            </div>
        )
    }

    const val = (num: number) => num === 0 ? '' : num.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const totalLiabilitiesEquity = data.totalLiabilities + data.totalEquity + data.retainedEarnings;

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">BALANCE SHEET</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
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
                            <span className="text-[12px] font-black uppercase">Balance Sheet</span>
                            <div className="flex items-center gap-2 text-[10px] bg-[#002b2b] px-3 py-1 border border-[#008080]">
                                <Calendar className="h-3 w-3 text-[#64ffff]" />
                                <span className="text-[#64ffff]">As at:</span>
                                <span className="text-white font-bold">{format(date, 'd-MMM-yy').toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.print()} className="h-7 px-4 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[10px] font-black flex items-center gap-2 transition-all">
                                <Printer className="h-3 w-3" /> PRINT
                            </button>
                        </div>
                    </div>

                    {/* TWO COLUMN TALLY LAYOUT */}
                    <div className="flex-1 overflow-auto flex flex-col p-4">
                        <div className="flex-1 border border-[#006666] flex flex-col bg-[#002b2b]">
                            {/* Column Headers */}
                            <div className="grid grid-cols-2 border-b border-[#008080] font-black text-[11px] bg-[#006666]">
                                <div className="grid grid-cols-12 divide-x divide-[#008080]">
                                    <div className="col-span-9 px-4 py-2">LIABILITIES</div>
                                    <div className="col-span-3 px-4 py-2 text-right">AS AT {format(date, 'd-MMM-yy').toUpperCase()}</div>
                                </div>
                                <div className="grid grid-cols-12 divide-x divide-[#008080] border-l border-[#008080]">
                                    <div className="col-span-9 px-4 py-2">ASSETS</div>
                                    <div className="col-span-3 px-4 py-2 text-right">AS AT {format(date, 'd-MMM-yy').toUpperCase()}</div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 grid grid-cols-2 min-h-[500px]">
                                {/* LEFT SIDE: Liabilities & Equity */}
                                <div className="border-r border-[#006666] flex flex-col">
                                    <div className="p-4 space-y-1 flex-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1">CAPITAL ACCOUNT</div>
                                        {data.equity.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333] italic">
                                            <div className="col-span-9 text-white">RETAINED EARNINGS (P&L)</div>
                                            <div className="col-span-3 text-right">{val(data.retainedEarnings)}</div>
                                        </div>

                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1 mt-10 uppercase">Loans (Liability)</div>
                                        <div className="text-[10px] text-slate-600 italic">Nil</div>

                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1 mt-10 uppercase">Current Liabilities</div>
                                        {data.liabilities.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* RIGHT SIDE: Assets */}
                                <div className="flex flex-col">
                                    <div className="p-4 space-y-1 flex-1">
                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1 uppercase">Fixed Assets</div>
                                        <div className="text-[10px] text-slate-600 italic">Nil (Recorded at Branch level)</div>

                                        <div className="text-[10px] font-black text-[#64ffff] mb-2 border-b border-[#004d4d] pb-1 mt-10 uppercase">Current Assets</div>
                                        {data.assets.map(item => (
                                            <div key={item.name} className="grid grid-cols-12 text-[11px] py-0.5 group hover:bg-[#003333]">
                                                <div className="col-span-9 text-white">{item.name.toUpperCase()}</div>
                                                <div className="col-span-3 text-right">{val(item.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Grand Total Footer */}
                            <div className="grid grid-cols-2 border-t-2 border-[#008080] font-black text-[12px] bg-[#004d4d]">
                                <div className="grid grid-cols-12 divide-x divide-[#008080]">
                                    <div className="col-span-9 px-4 py-2 text-right text-[#64ffff]">TOTAL</div>
                                    <div className="col-span-3 px-4 py-2 text-right">
                                        {val(totalLiabilitiesEquity)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 divide-x divide-[#008080] border-l border-[#008080]">
                                    <div className="col-span-9 px-4 py-2 text-right text-[#64ffff]">TOTAL</div>
                                    <div className="col-span-3 px-4 py-2 text-right">
                                        {val(data.totalAssets)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Info Bar */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[9px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff]">ASSET VALUATION: COST</span>
                            <span className="text-[#64ffff]">STATUS: BALANCED</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-white">F11: FEATURES</span>
                            <span className="text-white">F12: CONFIGURE</span>
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
                            { f: 'F10', l: 'P & L' },
                            { f: 'F11', l: 'Features' },
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
    )
}
