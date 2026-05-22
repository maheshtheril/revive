'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
    Activity, History, Download, TrendingUp, TrendingDown, 
    Wallet, Landmark, Receipt, CreditCard, Layers, 
    ChevronRight, ArrowRightLeft, ShieldCheck, Zap,
    FileText, BarChart3, PieChart, RefreshCcw, Calculator
} from 'lucide-react'
import { useLocalization } from '@/contexts/localization-context'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardDateFilter } from '../hms/dashboard-date-filter'
import { cn } from '@/lib/utils'

// [AUDIT ACTION IMPORTS] 
import {
    getDailyAccountingSummary,
    getProfitAndLossStatement,
    getBalanceSheetStatement,
    getExecutiveInsights
} from "@/app/actions/accounting/reports"

/**
 * FINANCIAL PRIME CONTROL CENTER - WORLD STANDARD EDITION
 * High-Density, Audit-Grade Financial Intelligence Dashboard.
 * 
 * THEME AWARE: Tally-Inspired in Dark Mode / Professional ERP in Light Mode.
 */
export function FinancialDashboard({
    currencyCode = 'INR',
    currencySymbol = 'Rs.', // SAFE FALLBACK: Switched to Rs. to prevent character corruption
}: {
    currencyCode?: string,
    currencySymbol?: string,
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { formatCurrency, formatDate } = useLocalization()
    
    // Sync date with URL Search Param
    const queryDate = searchParams.get('date')
    let date = new Date()
    if (queryDate) {
        const d = new Date(queryDate)
        if (!isNaN(d.getTime())) {
            date = d
        }
    }

    const [loading, setLoading] = useState(true)
    const [dailyData, setDailyData] = useState<any>(null)
    const [plData, setPlData] = useState<any>(null)
    const [bsData, setBsData] = useState<any>(null)
    const [insights, setInsights] = useState<string[]>([])
    
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
                const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

                const [daily, pl, bs, insightRes] = await Promise.all([
                    getDailyAccountingSummary(date),
                    getProfitAndLossStatement(startOfMonth, endOfMonth),
                    getBalanceSheetStatement(date),
                    getExecutiveInsights()
                ])

                if (daily.success) setDailyData(daily.data)
                if (pl.success) setPlData(pl.data)
                if (bs.success) setBsData(bs.data)
                if (insightRes.success) setInsights((insightRes as any).data || [])
            } catch (error) {
                console.error("Institutional Fetching Failed", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [date])

    // SAFE CURRENCY RENDERER
    const renderAmount = (amount: number, options: { color?: string, large?: boolean } = {}) => {
        const val = formatCurrency(amount, currencySymbol);
        // Ensure symbol is always before and correct
        const cleanVal = val.replace('\u20B9', 'Rs.').replace('Γé╣', 'Rs.');
        return <span className={cn(options.large ? "text-xl font-black tracking-tighter" : "font-black", options.color || "text-foreground")}>{cleanVal}</span>;
    }

    if (loading && !dailyData) {
        return (
            <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700 font-mono">
                <div className="p-10 border-4 border-primary animate-pulse">
                    <RefreshCcw className="h-16 w-16 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-foreground font-black text-2xl uppercase tracking-widest">GATEWAY OF HMS</p>
                    <p className="text-muted-foreground text-xs font-bold tracking-[0.4em] uppercase">Syncing Institutional Ledgers...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-mono p-1 flex flex-col gap-1 overflow-x-hidden transition-colors duration-500">
            
            {/* 1. INSTITUTIONAL TOP BAR - ADAPTIVE THEME */}
            <div className="h-10 bg-slate-100 dark:bg-[#003333] flex items-center justify-between px-6 border-b border-slate-200 dark:border-[#004d4d] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-[#64ffff]">Live Audit Active</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-[#ffffcc]/60 uppercase">
                        Medical Day: <span className="text-primary dark:text-[#ffffcc]">{format(new Date(), 'EEEE, MMM dd').toUpperCase()} (08:00 Shift)</span>
                    </span>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-bold text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5" />
                        <span>{formatDate(date, 'MMMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>POSTED & VERIFIED</span>
                    </div>
                </div>
            </div>

            {/* 2. EXECUTIVE DASHBOARD GRID */}
            <div className="flex-1 grid grid-cols-12 gap-1 p-1 overflow-hidden">
                
                {/* LEFT COLUMN: CONTROL & INSIGHTS */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-1">
                    
                    {/* Action Hub */}
                    <div className="bg-card p-6 border border-border flex flex-col gap-4">
                        <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b border-border pb-2">Entry Gateway</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { icon: Receipt, label: 'Journal Voucher', path: '/hms/accounting/journals/new', key: 'F7' },
                                { icon: CreditCard, label: 'Payment Voucher', path: '/hms/accounting/payments/new', key: 'F5' },
                                { icon: History, label: 'Receipt Voucher', path: '/hms/accounting/receipts/new', key: 'F6' },
                                { icon: Layers, label: 'Chart of Accounts', path: '/hms/accounting/coa', key: 'G' },
                                { icon: Calculator, label: 'Accounting Config', path: '/settings/accounting', key: 'F12' }
                            ].map((action, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => router.push(action.path)}
                                    className="flex items-center justify-between px-3 py-2 bg-secondary hover:bg-primary hover:text-primary-foreground transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <action.icon className="h-3.5 w-3.5 group-hover:scale-110" />
                                        <span className="text-[10px] font-bold uppercase">{action.label}</span>
                                    </div>
                                    <span className="text-[9px] opacity-40 group-hover:opacity-100">{action.key}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Intelligence / Anomalies */}
                    <div className="flex-1 bg-card p-6 border border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Audit Alerts</h3>
                            <Zap className="h-3 w-3 text-yellow-500 animate-pulse" />
                        </div>
                        <div className="flex flex-col gap-4 overflow-auto max-h-[400px]">
                            {insights.length > 0 ? insights.map((insight, idx) => (
                                <div key={idx} className="bg-secondary p-3 border-l-2 border-red-500">
                                    <p className="text-[10px] leading-relaxed text-foreground">{insight.replace('\u20B9', 'Rs.').replace('₹', 'Rs.')}</p>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-30">
                                    <p className="text-[10px] italic">No Audit Anomalies Found</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Global Filter */}
                    <div className="bg-card p-4 border border-border">
                        <DashboardDateFilter />
                    </div>
                </div>

                {/* MIDDLE COLUMN: MAIN FINANCIAL STATEMENTS */}
                <div className="col-span-12 lg:col-span-6 flex flex-col gap-1">
                    
                    {/* TOP STATS BAR */}
                    <div className="grid grid-cols-4 gap-1">
                        {[
                            { label: "NET PROFIT", val: plData?.netProfit || 0, color: (plData?.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500') },
                            { label: "CASH FLOW", val: dailyData?.netCashFlow || 0, color: 'text-primary' },
                            { label: "RECEIVABLES", val: bsData?.totalReceivables || 0, color: 'text-foreground' },
                            { label: "PAYABLES", val: bsData?.totalPayables || 0, color: 'text-red-500' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-card p-4 border border-border flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase opacity-50">{stat.label}</span>
                                {renderAmount(stat.val, { color: stat.color, large: true })}
                            </div>
                        ))}
                    </div>

                    {/* MAIN STATEMENT VIEW */}
                    <div className="flex-1 bg-card border border-border flex flex-col">
                        <Tabs defaultValue="pl" className="flex flex-col h-full">
                            <TabsList className="bg-secondary rounded-none border-b border-border p-0 h-10 w-full justify-start gap-1">
                                <TabsTrigger value="pl" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 text-[10px] font-black uppercase tracking-widest h-full">Operating P&L</TabsTrigger>
                                <TabsTrigger value="bs" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 text-[10px] font-black uppercase tracking-widest h-full">Balance Architecture</TabsTrigger>
                                <TabsTrigger value="daily" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 text-[10px] font-black uppercase tracking-widest h-full">Stream Analysis</TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-auto p-8">
                                <TabsContent value="pl" className="m-0 focus:outline-none">
                                    <div className="max-w-3xl mx-auto space-y-12">
                                        <div className="flex justify-between items-end border-b-2 border-primary pb-4">
                                            <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground">Income Statement</h2>
                                            <span className="text-[10px] opacity-40 italic uppercase">Period Ending {formatDate(date, 'MMM d, yyyy')}</span>
                                        </div>

                                        <section className="space-y-4">
                                            <div className="flex justify-between text-[11px] font-black uppercase text-primary border-b border-border pb-2">
                                                <span>Revenue Streams</span>
                                                <span>{renderAmount(plData?.totalRevenue || 0)}</span>
                                            </div>
                                            <div className="space-y-2 pl-4">
                                                {plData?.revenue?.map((r: any) => (
                                                    <div key={r.name} className="flex justify-between text-[10px] opacity-70 group hover:opacity-100 border-b border-border/10 pb-1">
                                                        <span>{r.name.toUpperCase()}</span>
                                                        {renderAmount(r.amount)}
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <div className="flex justify-between text-[11px] font-black uppercase text-red-500 border-b border-border pb-2">
                                                <span>Operating Burn</span>
                                                <span>{renderAmount(plData?.totalExpenses || 0, { color: 'text-red-500' })}</span>
                                            </div>
                                            <div className="space-y-2 pl-4">
                                                {plData?.expenses?.map((e: any) => (
                                                    <div key={e.name} className="flex justify-between text-[10px] opacity-70 group hover:opacity-100 border-b border-border/10 pb-1">
                                                        <span>{e.name.toUpperCase()}</span>
                                                        {renderAmount(e.amount, { color: 'text-red-500' })}
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <div className="pt-8 border-t-4 border-primary flex justify-between items-center bg-secondary/50 p-6">
                                            <span className="text-xl font-black uppercase text-foreground">NET PROFIT</span>
                                            <span className="flex items-center gap-1">
                                                {renderAmount(plData?.netProfit || 0, { 
                                                    large: true, 
                                                    color: plData?.netProfit >= 0 ? 'text-emerald-500 text-4xl' : 'text-red-500 text-4xl' 
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="bs" className="m-0 h-full focus:outline-none">
                                    <div className="grid grid-cols-2 gap-8 h-full">
                                        <div className="border border-border p-6 bg-secondary/20">
                                            <h3 className="text-[11px] font-black uppercase text-primary border-b border-border pb-2 mb-4 italic">Assets (Inflow Capacity)</h3>
                                            <div className="space-y-3">
                                                {bsData?.assets?.map((a: any) => (
                                                    <div key={a.name} className="flex justify-between text-[10px] border-b border-border/30 pb-2">
                                                        <span className="opacity-60">{a.name.toUpperCase()}</span>
                                                        {renderAmount(a.amount)}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-8 flex justify-between text-lg font-black text-foreground border-t-2 border-primary pt-4">
                                                <span>TOTAL ASSETS</span>
                                                {renderAmount(bsData?.totalAssets || 0)}
                                            </div>
                                        </div>
                                        <div className="border border-border p-6 bg-secondary/20">
                                            <h3 className="text-[11px] font-black uppercase text-red-500 border-b border-border pb-2 mb-4 italic">Liabilities & Equity</h3>
                                            <div className="space-y-3">
                                                {bsData?.liabilities?.map((l: any) => (
                                                    <div key={l.name} className="flex justify-between text-[10px] border-b border-border/30 pb-2">
                                                        <span className="opacity-60">{l.name.toUpperCase()}</span>
                                                        {renderAmount(l.amount, { color: 'text-red-500' })}
                                                    </div>
                                                ))}
                                                {bsData?.equity?.map((e: any) => (
                                                    <div key={e.name} className="flex justify-between text-[10px] border-b border-border/30 pb-2">
                                                        <span className="opacity-60">{e.name.toUpperCase()}</span>
                                                        {renderAmount(e.amount)}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-8 flex justify-between text-lg font-black text-foreground border-t-2 border-foreground pt-4">
                                                <span>TOTAL SOURCES</span>
                                                {renderAmount((bsData?.totalLiabilities || 0) + (bsData?.totalEquity || 0))}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="daily" className="m-0 focus:outline-none">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-black uppercase text-primary border-b border-border pb-2">Revenue Groupwise</h4>
                                            {Object.entries(dailyData?.revenueByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                <div key={acc} className="flex justify-between items-center bg-secondary p-4 border border-border">
                                                    <span className="text-[11px] font-bold">{acc.toUpperCase()}</span>
                                                    {renderAmount(amt, { large: true })}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-6">
                                            <h4 className="text-[10px] font-black uppercase text-red-500 border-b border-border pb-2">Expense Groupwise</h4>
                                            {Object.entries(dailyData?.expenseByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                <div key={acc} className="flex justify-between items-center bg-secondary p-4 border border-border">
                                                    <span className="text-[11px] font-bold">{acc.toUpperCase()}</span>
                                                    {renderAmount(amt, { large: true, color: 'text-red-500' })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>

                {/* RIGHT COLUMN: INSTITUTIONAL RECOVERY & HUB */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-1">
                    
                    {/* Liquidity Hub */}
                    <div className="bg-card p-6 border border-border flex flex-col gap-6">
                        <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b border-border pb-2">Liquidity Architecture</h3>
                        <div className="space-y-4">
                            <div className="p-5 bg-secondary border border-border flex flex-col gap-2 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-primary/5 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Wallet className="h-3 w-3 text-emerald-500" />
                                        <span className="text-[9px] font-black uppercase opacity-50">Physical Cash Reserves</span>
                                    </div>
                                    <p className="text-2xl font-black text-foreground">
                                        {renderAmount(bsData?.assets?.find((a: any) => a.name.toLowerCase().includes('cash'))?.amount || 0)}
                                    </p>
                                </div>
                            </div>
                            <div className="p-5 bg-secondary border border-border flex flex-col gap-2 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-primary/5 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Landmark className="h-3 w-3 text-blue-500" />
                                        <span className="text-[9px] font-black uppercase opacity-50">Total Bank Assets</span>
                                    </div>
                                    <p className="text-2xl font-black text-foreground">
                                        {renderAmount(bsData?.assets?.find((a: any) => a.name.toLowerCase().includes('bank'))?.amount || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Navigation Grid */}
                    <div className="flex-1 bg-card p-6 border border-border flex flex-col gap-4">
                        <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b border-border pb-2">Reporting Node</h3>
                        <div className="grid grid-cols-2 gap-1">
                            {[
                                { icon: FileText, label: 'Daybook', path: '/hms/accounting/daybook' },
                                { icon: ArrowRightLeft, label: 'G. Ledger', path: '/hms/accounting/ledger' },
                                { icon: Landmark, label: 'Cashbook', path: '/hms/accounting/cashbook' },
                                { icon: Landmark, label: 'Bankbook', path: '/hms/accounting/bankbook' },
                                { icon: BarChart3, label: 'T. Balance', path: '/hms/accounting/trial-balance' },
                                { icon: PieChart, label: 'Ageing', path: '/hms/accounting/ageing' }
                            ].map((report, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => router.push(report.path)}
                                    className="p-4 bg-secondary border border-border flex flex-col items-center gap-3 hover:bg-primary hover:text-primary-foreground transition-all group"
                                >
                                    <report.icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-center">{report.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Institutional Export Bar */}
                    <Button variant="default" className="h-14 w-full rounded-none font-black text-xs uppercase tracking-widest gap-3 shadow-lg">
                        <Download className="h-4 w-4" /> EXPORT FISCAL DATA
                    </Button>
                </div>
            </div>

            {/* 3. INSTITUTIONAL FOOTER BAR */}
            <div className="h-8 bg-secondary border-t border-border flex items-center justify-between px-6 text-[9px] font-bold text-muted-foreground">
                <div className="flex gap-8">
                    <span>LICENSE: INSTITUTIONAL PRIME</span>
                    <span>ENV: PRODUCTION_GATEWAY</span>
                </div>
                <div className="flex gap-8">
                    <span>SERVER SYNC: OPTIMIZED</span>
                    <span className="text-primary italic font-black uppercase tracking-tighter">Institutional Audit Mode (8:00 AM Cutoff) Active</span>
                </div>
            </div>
        </div>
    );
}
