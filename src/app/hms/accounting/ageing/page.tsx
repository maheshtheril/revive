'use client'

import { useState, useEffect } from 'react'
import { 
    FileText, Printer, Download, Filter, 
    Search, Calendar, ArrowUpRight, ArrowDownRight,
    Loader2
} from 'lucide-react'
import { getAgeingReport } from "@/app/actions/accounting/reports"
import { motion } from 'framer-motion'
import { format } from 'date-fns'

export default function AgeingReportPage() {
    const [loading, setLoading] = useState(true)
    const [type, setType] = useState<'receivables' | 'payables'>('receivables')
    const [data, setData] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadData()
    }, [type])

    async function loadData() {
        setLoading(true)
        const res = await getAgeingReport(type)
        if (res.success) {
            setData(res.data || [])
        }
        setLoading(false)
    }

    const filtered = data.filter(d => 
        d.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.number.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totals = filtered.reduce((acc, curr) => ({
        amount: acc.amount + curr.amount,
        outstanding: acc.outstanding + curr.outstanding,
        '0-30': acc['0-30'] + curr.slots['0-30'],
        '30-60': acc['30-60'] + curr.slots['30-60'],
        '60-90': acc['60-90'] + curr.slots['60-90'],
        '90+': acc['90+'] + curr.slots['90+'],
    }), { amount: 0, outstanding: 0, '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 })

    return (
        <div className="min-h-screen bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-4 border-b border-[#006666] text-[10px] font-bold no-print">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">BILL-WISE AGEING ANALYSIS</span>
                    <span className="text-[#ffffcc]">System Integrated Report</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Enterprise ERP</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex gap-1 p-1 overflow-hidden">
                {/* Main Report Sidebar (Tally style) */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col no-print">
                    <div className="h-10 bg-[#004d4d] flex items-center px-4 border-b border-[#006666]">
                        <span className="text-[10px] font-black text-[#64ffff] uppercase">Report Type</span>
                    </div>
                    <div className="p-1 space-y-1">
                        <button 
                            onClick={() => setType('receivables')}
                            className={`w-full h-8 flex items-center px-3 text-[10px] font-bold border transition-all ${type === 'receivables' ? 'bg-[#64ffff] text-black border-[#64ffff]' : 'text-[#ffffcc] bg-[#002b2b] border-[#004d4d] hover:bg-[#003333]'}`}
                        >
                            RECEIVABLES (PATIENTS)
                        </button>
                        <button 
                            onClick={() => setType('payables')}
                            className={`w-full h-8 flex items-center px-3 text-[10px] font-bold border transition-all ${type === 'payables' ? 'bg-[#64ffff] text-black border-[#64ffff]' : 'text-[#ffffcc] bg-[#002b2b] border-[#004d4d] hover:bg-[#003333]'}`}
                        >
                            PAYABLES (SUPPLIERS)
                        </button>
                    </div>
                </div>

                {/* Report Table */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col overflow-hidden">
                    <div className="h-10 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080] no-print">
                        <div className="flex items-center gap-6">
                            <span className="text-[12px] font-black uppercase">Outstanding Statement ({type})</span>
                            <div className="relative group">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#64ffff]" />
                                <input 
                                    type="text" 
                                    placeholder="SEARCH PARTY/BILL..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-6 pl-7 pr-2 bg-[#002b2b] border border-[#008080] rounded text-[10px] text-[#ffffcc] focus:outline-none focus:border-[#64ffff] w-48 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => window.print()} className="h-6 px-3 bg-[#002b2b] hover:bg-[#003333] border border-[#008080] rounded text-[9px] font-black flex items-center gap-2">
                                <Printer className="h-3 w-3" /> PRINT
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-[10px] border-collapse relative">
                            <thead className="sticky top-0 bg-[#006666] z-10 shadow-md">
                                <tr className="text-[#64ffff] border-b border-[#008080]">
                                    <th className="px-4 py-2 text-left">Date</th>
                                    <th className="px-4 py-2 text-left">Bill No.</th>
                                    <th className="px-4 py-2 text-left">Party Name</th>
                                    <th className="px-4 py-2 text-right">Pending Amount</th>
                                    <th className="px-4 py-2 text-right bg-[#005555]">0-30 Days</th>
                                    <th className="px-4 py-2 text-right">30-60 Days</th>
                                    <th className="px-4 py-2 text-right">60-90 Days</th>
                                    <th className="px-4 py-2 text-right">Over 90</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center animate-pulse text-[#64ffff]">CALCULATING AGEING DATA...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center opacity-30 italic">No outstanding balances found for selected filters.</td>
                                    </tr>
                                ) : filtered.map(row => (
                                    <tr key={row.id} className="border-b border-[#003333] hover:bg-[#002b2b] transition-colors">
                                        <td className="px-4 py-2">{format(new Date(row.date), 'dd-MMM-yy').toUpperCase()}</td>
                                        <td className="px-4 py-2 font-bold">{row.number}</td>
                                        <td className="px-4 py-2 text-white font-black">{row.party.toUpperCase()}</td>
                                        <td className="px-4 py-2 text-right font-black">{row.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-2 text-right bg-[#005555]/30">{row.slots['0-30'] > 0 ? row.slots['0-30'].toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                        <td className="px-4 py-2 text-right">{row.slots['30-60'] > 0 ? row.slots['30-60'].toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                        <td className="px-4 py-2 text-right">{row.slots['60-90'] > 0 ? row.slots['60-90'].toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                        <td className="px-4 py-2 text-right text-rose-400 font-bold">{row.slots['90+'] > 0 ? row.slots['90+'].toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-[#003333] border-t-2 border-[#008080] font-black">
                                <tr>
                                    <td colSpan={3} className="px-4 py-2 text-right text-[#64ffff] uppercase">Total Outstanding Position</td>
                                    <td className="px-4 py-2 text-right text-white">{totals.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2 text-right bg-[#005555]/50">{totals['0-30'].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2 text-right">{totals['30-60'].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2 text-right">{totals['60-90'].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2 text-right text-rose-400">{totals['90+'].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer Stats */}
                    <div className="h-8 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-6 text-[9px] font-bold no-print">
                        <div className="flex gap-8">
                            <span className="text-[#64ffff]">RECORDS: {filtered.length}</span>
                            <span className="text-white">DUE OVER 90 DAYS: {totals['90+'].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[#64ffff] animate-pulse">CLASSIC ERP GATEWAY</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
