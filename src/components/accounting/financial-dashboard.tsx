'use client'

import { useState, useEffect, Suspense } from 'react'
import {
    TrendingUp, TrendingDown, DollarSign, PieChart,
    ArrowRight, Calendar, Filter, Download,
    BarChart3, Landmark, Receipt, Wallet,
    ArrowUpRight, ArrowDownRight, RefreshCcw,
    Activity, ShieldCheck, Zap, Layers,
    ChevronRight, CreditCard, Banknote, History,
    FileText
} from 'lucide-react'
import { useLocalization } from '@/contexts/localization-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardDateFilter } from '../hms/dashboard-date-filter'

// [AUDIT ACTION IMPORTS] 
import {
    getDailyAccountingSummary,
    getProfitAndLossStatement,
    getBalanceSheetStatement,
    getFinancialTrends,
    getExecutiveInsights
} from "@/app/actions/accounting/reports"
import { ClassicProfitLoss } from "./classic-profit-loss"
import { ClassicBalanceSheet } from "./classic-balance-sheet"

/**
 * World Standard Financial Intelligence Dashboard
 * Bedrock Radiant Stability Edition (Zero-Motion, Zero-Dynamic Chart)
 * Optimized for Next.js 16/19 hydration stability
 */
export function FinancialDashboard({
    currencyCode = 'INR',
    currencySymbol = '₹',
    initialView = 'modern',
    initialTab = 'pl'
}: {
    currencyCode?: string,
    currencySymbol?: string,
    initialView?: 'modern' | 'classic',
    initialTab?: 'pl' | 'bs'
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { formatNumber, formatCurrency, formatDate } = useLocalization()
    
    // Sync date with URL Search Param
    const queryDate = searchParams.get('date')
    const date = queryDate ? new Date(queryDate) : new Date()

    const [loading, setLoading] = useState(true)
    const [dailyData, setDailyData] = useState<any>(null)
    const [plData, setPlData] = useState<any>(null)
    const [bsData, setBsData] = useState<any>(null)
    const [insights, setInsights] = useState<string[]>([])
    
    const [viewMode, setViewMode] = useState<'modern' | 'classic'>(initialView)
    const [classicTab, setClassicTab] = useState<'pl' | 'bs'>(initialTab)
    const [activeModernTab, setActiveModernTab] = useState<string>('pl')

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
                console.error("Neural Fetching Failed", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [date])

    if (loading && !dailyData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] gap-6 animate-in fade-in duration-700">
                <div className="p-4 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-500/20 animate-bounce">
                    <History className="h-10 w-10 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-slate-900 dark:text-white font-black text-xl tracking-tight uppercase">Initializing High-Performance Ledger</p>
                    <p className="text-slate-500 font-bold text-sm tracking-widest animate-pulse">SYNTHESIZING FINANCIAL TELEMETRY...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 p-4 md:p-8 pb-24 max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Premium Intelligence Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-600/30">
                            <Activity className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-1">
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">Live Data Engine Active</Badge>
                            <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                                Financial <span className="text-indigo-600">Overview</span>
                            </h1>
                        </div>
                    </div>
                    <p className="text-slate-400 font-bold text-lg max-w-xl">Deep-level fiscal oversight and executive performance analytics across your whole hospital network.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 relative z-10">
                    <Button
                        variant={viewMode === 'classic' ? 'default' : 'outline'}
                        onClick={() => setViewMode(viewMode === 'modern' ? 'classic' : 'modern')}
                        className={`h-14 px-8 rounded-2xl border-slate-200 dark:border-slate-800 gap-3 transition-all font-black text-xs uppercase tracking-widest ${viewMode === 'classic' ? 'bg-[#002b2b] text-[#ffffcc] hover:bg-[#004d4d]' : ''}`}
                    >
                        <Landmark className="h-5 w-5" />
                        {viewMode === 'modern' ? 'Switch to Classic Audit' : 'Return to Dashboard'}
                    </Button>
                    <DashboardDateFilter />
                    <Button className="h-14 px-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-black dark:hover:bg-slate-100 transition-all gap-3 font-black shadow-2xl shadow-slate-900/20">
                        <Download className="h-5 w-5" /> EXPORT REPORT
                    </Button>
                </div>
            </div>

            {/* Core Neural KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <Card className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-[2.5rem] border-none shadow-2xl shadow-indigo-600/20">
                    <div className="absolute top-0 right-0 p-10 opacity-10 scale-150 rotate-12 transition-transform group-hover:rotate-0 duration-700">
                        <TrendingUp size={120} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-indigo-100/50 font-black uppercase tracking-[0.2em] text-[10px]">Today's Sales</CardDescription>
                        <CardTitle className="text-5xl font-black tracking-tighter">{formatCurrency(dailyData?.totalSales || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full w-fit flex items-center gap-2">
                            <span className={`text-[10px] font-black ${dailyData?.deltas?.sales >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {dailyData?.deltas?.sales >= 0 ? '+' : ''}{dailyData?.deltas?.sales?.toFixed(1)}%
                            </span>
                            <span className="text-[10px] font-bold text-indigo-100/50 uppercase">vs yesterday</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50">
                    <div className="absolute top-0 right-0 p-10 opacity-5 text-indigo-600 group-hover:scale-125 transition-transform duration-1000">
                        <PieChart size={120} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Net Margin</CardDescription>
                        <CardTitle className={`text-5xl font-black tracking-tighter ${plData?.netProfit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                            {formatCurrency(plData?.netProfit || 0)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-3 py-1 border-slate-200">
                            {((plData?.netProfit / (plData?.totalRevenue || 1)) * 100).toFixed(1)}% profit margin
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50">
                    <div className="absolute top-0 right-0 p-10 opacity-5 text-rose-500 group-hover:scale-125 transition-transform duration-1000">
                        <ArrowDownRight size={120} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Today's Outflow</CardDescription>
                        <CardTitle className="text-5xl font-black tracking-tighter text-rose-500">{formatCurrency(dailyData?.totalPurchases || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liabilities & procurement flow</p>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-slate-900 text-white rounded-[2.5rem] border-none shadow-2xl">
                    <div className="absolute top-0 right-0 p-10 opacity-20 group-hover:scale-110 transition-transform duration-700">
                        <Wallet size={120} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Enterprise Assets</CardDescription>
                        <CardTitle className="text-5xl font-black tracking-tighter text-indigo-400">{formatCurrency(bsData?.totalAssets || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-indigo-400">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Asset Integrity Locked</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Primary Analysis & Velocity Control */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border-none p-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-1">Performance Intelligence</h2>
                            <p className="text-slate-400 font-bold tracking-wide">Synthesized executive insights and neural patterns for {formatDate(date, 'MMMM yyyy')}.</p>
                        </div>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex items-center gap-4">
                            <Zap className="h-8 w-8 text-indigo-600" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Neural Sync Status</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">OPTIMIZED & LIVE</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 border-l-4 border-indigo-600 pl-4">Tactical Intelligence</h3>
                            <div className="space-y-4">
                                {insights.length > 0 ? insights.map((insight, idx) => (
                                    <div key={idx} className="flex gap-4 group p-1 transition-all">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0 group-hover:scale-150 transition-all shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                                        <p className="text-sm text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{insight}</p>
                                    </div>
                                )) : (
                                    <div className="p-10 border-2 border-dotted border-slate-100 rounded-[2rem] text-center">
                                        <RefreshCcw className="h-8 w-8 text-slate-200 mx-auto mb-4 animate-spin" />
                                        <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Scanning Operating Cycles...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-2xl">
                             <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12 scale-125 transition-transform group-hover:rotate-0 duration-700">
                                <Activity size={150} strokeWidth={1} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black mb-1">Audit Position</h3>
                                <p className="text-indigo-100/60 font-bold text-xs uppercase tracking-widest mb-10">Consolidated System Balance</p>
                                
                                <div className="space-y-8">
                                    <div className="flex justify-between items-end pb-3 border-b border-indigo-500/30">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Total Corporate Assets</span>
                                        <span className="text-2xl font-black tracking-tighter">{formatCurrency(bsData?.totalAssets || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-end pb-3 border-b border-indigo-500/30">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Operating Liabilities</span>
                                        <span className="text-2xl font-black tracking-tighter">({formatCurrency(bsData?.totalLiabilities || 0)})</span>
                                    </div>
                                    <div className="pt-6">
                                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1 text-indigo-200">Net Enterprise Value</span>
                                        <p className="text-5xl font-black tracking-tighter">{formatCurrency(bsData?.totalEquity || 0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Tactical Control Cluster */}
                <div className="lg:col-span-4 space-y-8">
                    <Card className="bg-slate-900 border-none rounded-[3rem] p-10 text-white shadow-2xl">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-2xl font-black tracking-tighter">Control Hub</h3>
                            <Badge className="bg-white/10 text-white font-black border-none uppercase text-[8px] tracking-[0.2em]">Tier-1 Ops</Badge>
                        </div>
                        
                        <div className="space-y-4">
                            {[
                                { icon: Receipt, label: 'Post Journal Entry', sub: 'Manual Adjusting Flow', path: '/hms/accounting/journals/new', color: 'indigo-500' },
                                { icon: CreditCard, label: 'Voucher Payment', sub: 'Cash/Bank Outflow', path: '/hms/accounting/payments/new', color: 'emerald-500' },
                                { icon: History, label: 'Voucher Receipt', sub: 'Revenue Inflow', path: '/hms/accounting/receipts/new', color: 'blue-500' },
                                { icon: Layers, label: 'Chart of Accounts', sub: 'Ledger Architecture', path: '/hms/accounting/coa', color: 'amber-500' }
                            ].map((action, idx) => (
                                <Button 
                                    key={idx}
                                    onClick={() => router.push(action.path)}
                                    className="w-full h-16 bg-white/5 hover:bg-white/10 rounded-2xl justify-between px-6 border border-white/5 group transition-all"
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={`p-2.5 bg-${action.color}/20 rounded-xl group-hover:scale-110 transition-transform`}>
                                            <action.icon className={`h-5 w-5 text-${action.color}`} />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">{action.label}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{action.sub}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            ))}
                        </div>
                    </Card>

                    <Card className="bg-white dark:bg-slate-900 rounded-[3rem] border-none p-10 shadow-2xl divide-y divide-slate-50 dark:divide-slate-800">
                        <div className="pb-8">
                             <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] mb-6 text-center italic">Institutional Reserves</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl text-center border border-slate-100 dark:border-slate-800 group hover:border-emerald-500/30 transition-all">
                                    <Banknote className="h-5 w-5 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Physical Cash</p>
                                    <p className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">
                                        {formatCurrency(bsData?.assets?.find((a: any) => a.name.toLowerCase().includes('cash'))?.amount || 0)}
                                    </p>
                                </div>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl text-center border border-slate-100 dark:border-slate-800 group hover:border-indigo-500/30 transition-all">
                                    <Landmark className="h-5 w-5 text-indigo-500 mx-auto mb-3" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Bank Assets</p>
                                    <p className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">
                                        {formatCurrency(bsData?.assets?.find((a: any) => a.name.toLowerCase().includes('bank'))?.amount || 0)}
                                    </p>
                                </div>
                             </div>
                        </div>

                        <div className="pt-8">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-6 text-center">Audit Intelligence Hub</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: FileText, label: 'Daybook', path: '/hms/accounting/daybook' },
                                    { icon: Banknote, label: 'Cashbook', path: '/hms/accounting/cashbook' },
                                    { icon: CreditCard, label: 'Bankbook', path: '/hms/accounting/bankbook' }
                                ].map((hub, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => router.push(hub.path)}
                                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex flex-col items-center gap-2 border border-slate-100 dark:border-slate-800 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                    >
                                        <hub.icon className="h-4 w-4" />
                                        <span className="text-[8px] font-black uppercase tracking-widest">{hub.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Financial Ledger View Stack */}
            <div className="mt-12 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl p-4 md:p-12 border-none">
                {viewMode === 'classic' ? (
                    <div className="space-y-8">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl w-fit mx-auto shadow-inner border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setClassicTab('pl')}
                                className={`px-10 py-3 rounded-xl text-xs font-black tracking-widest transition-all ${classicTab === 'pl' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                PROFIT & LOSS STATEMENTS
                            </button>
                            <button
                                onClick={() => setClassicTab('bs')}
                                className={`px-10 py-3 rounded-xl text-xs font-black tracking-widest transition-all ${classicTab === 'bs' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                BALANCE SHEET ARCHITECTURE
                            </button>
                        </div>
                        {classicTab === 'pl' ? (
                            <ClassicProfitLoss
                                data={plData}
                                startDate={new Date(date.getFullYear(), date.getMonth(), 1)}
                                endDate={new Date(date.getFullYear(), date.getMonth() + 1, 0)}
                                currencySymbol={currencySymbol}
                            />
                        ) : (
                            <ClassicBalanceSheet
                                data={bsData}
                                date={date}
                                currencySymbol={currencySymbol}
                            />
                        )}
                    </div>
                ) : (
                    <Tabs value={activeModernTab} onValueChange={setActiveModernTab} className="w-full">
                        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                             <TabsList className="bg-transparent gap-4 h-auto p-0">
                                {['daily', 'pl', 'bs'].map((tab) => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        className="rounded-2xl px-8 h-14 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                                    >
                                        {tab === 'daily' ? 'Clinical Streams' : tab === 'pl' ? 'Operating Margin' : 'Fiscal Reserves'}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <div className="px-8 py-2 bg-indigo-600/10 rounded-full border border-indigo-600/20 hidden md:flex items-center gap-3">
                                <History className="h-4 w-4 text-indigo-600" />
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">Institutional Audit Mode Active</span>
                            </div>
                        </div>

                        <div className="mt-12 animate-in fade-in duration-1000">
                            {activeModernTab === 'daily' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/50 p-1">
                                        <div className="bg-white dark:bg-slate-900 rounded-[2.8rem] h-full overflow-hidden">
                                            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-emerald-600/10 rounded-2xl">
                                                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">Clinical Revenue</h4>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Groupwise Analysis</p>
                                                    </div>
                                                </div>
                                                <Badge className="bg-emerald-600/10 text-emerald-600 border-none font-black px-4 py-1.5 uppercase text-[10px] tracking-widest">Inflow Active</Badge>
                                            </div>
                                            <div className="p-6 space-y-2">
                                                {Object.entries(dailyData?.revenueByAccount || {}).length > 0 ? (
                                                    Object.entries(dailyData?.revenueByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                        <div key={acc} className="flex items-center justify-between p-6 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
                                                            <div className="flex items-center gap-6">
                                                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xl shadow-emerald-500/50" />
                                                                <span className="font-black text-slate-700 dark:text-slate-300 text-sm italic">{acc}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-slate-900 dark:text-white text-xl tracking-tighter">{formatCurrency(amt)}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{((amt / (dailyData?.totalSales || 1)) * 100).toFixed(1)}% Share</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-24 text-center">
                                                        <Activity className="h-12 w-12 text-slate-100 mx-auto mb-6" />
                                                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs underline underline-offset-8">No Operating Revenue Synchronized</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/50 p-1">
                                        <div className="bg-white dark:bg-slate-900 rounded-[2.8rem] h-full overflow-hidden">
                                             <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-rose-600/10 rounded-2xl">
                                                        <TrendingDown className="h-6 w-6 text-rose-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">Operating Costs</h4>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expense Allocation</p>
                                                    </div>
                                                </div>
                                                <Badge className="bg-rose-600/10 text-rose-600 border-none font-black px-4 py-1.5 uppercase text-[10px] tracking-widest">Outflow Active</Badge>
                                            </div>
                                            <div className="p-6 space-y-2">
                                                {Object.entries(dailyData?.expenseByAccount || {}).length > 0 ? (
                                                    Object.entries(dailyData?.expenseByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                        <div key={acc} className="flex items-center justify-between p-6 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group border-l-4 border-transparent hover:border-rose-500">
                                                            <div className="flex items-center gap-6">
                                                                <div className="w-3 h-3 rounded-full bg-rose-500 group-hover:scale-125 transition-transform" />
                                                                <span className="font-black text-slate-700 dark:text-slate-300 text-sm italic">{acc}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-rose-500 text-xl tracking-tighter">{formatCurrency(amt)}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Operating Burn</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-24 text-center">
                                                        <ShieldCheck className="h-12 w-12 text-slate-100 mx-auto mb-6" />
                                                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Total Margin Retention - No Expenses</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {activeModernTab === 'pl' && (
                                <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden outline-none">
                                    <div className="p-16 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col md:flex-row justify-between items-center gap-12">
                                         <div className="text-center md:text-left">
                                            <h2 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-4">Profit & Loss</h2>
                                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                                <Badge className="bg-indigo-600 text-white border-none font-black px-4 py-1 text-[10px] uppercase tracking-widest shadow-2xl">Audit-Class Accrual</Badge>
                                                <span className="text-slate-400 font-bold text-sm tracking-wide">Flow period ending {formatDate(date, 'MMM d, yyyy')}</span>
                                            </div>
                                        </div>
                                        <div className="relative group">
                                             <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                                             <div className="relative bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl text-center min-w-[320px]">
                                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">Institutional Net Profit</p>
                                                <p className={`text-6xl font-black tracking-tighter ${plData?.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                    {formatCurrency(plData?.netProfit || 0)}
                                                </p>
                                                <div className="mt-6 flex items-center justify-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${plData?.netProfit >= 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">FISCAL RETENTION SCAN</span>
                                                </div>
                                             </div>
                                        </div>
                                    </div>
                                    
                                    <div className="max-w-5xl mx-auto py-24 px-10 space-y-24">
                                         <section>
                                            <div className="flex items-center justify-between mb-12 pb-6 border-b-4 border-slate-900 dark:border-white">
                                                <h3 className="text-sm font-black uppercase tracking-[0.5em] text-slate-400 italic">01. OPERATING REVENUE</h3>
                                                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(plData?.totalRevenue || 0)}</span>
                                            </div>
                                            <div className="space-y-6">
                                                {plData?.revenue?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between items-end pb-4 border-b border-dotted border-slate-100 dark:border-slate-800 group">
                                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                                        <div className="flex-1 mx-6 border-b border-dotted border-slate-100 dark:border-slate-800 mb-1" />
                                                        <span className="font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <div className="flex items-center justify-between mb-12 pb-6 border-b-4 border-rose-500">
                                                <h3 className="text-sm font-black uppercase tracking-[0.5em] text-rose-500 italic">02. DIRECT BURN (COGS)</h3>
                                                <span className="text-2xl font-black text-rose-500 tracking-tighter">({formatCurrency(plData?.totalCOGS || 0)})</span>
                                            </div>
                                            <div className="space-y-6">
                                                {plData?.cogs?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between items-end pb-4 border-b border-dotted border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs italic">{item.name}</span>
                                                        <div className="flex-1 mx-6 border-b border-dotted border-slate-100 dark:border-slate-800 mb-1" />
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">({formatCurrency(item.amount)})</span>
                                                    </div>
                                                ))}
                                                <div className="mt-12 p-10 bg-emerald-600 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12 group-hover:rotate-0 transition-transform">
                                                        <TrendingUp size={100} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] relative z-10">Consolidated Gross Margin</span>
                                                    <span className="text-4xl font-black tracking-tighter relative z-10">
                                                        {formatCurrency((plData?.totalRevenue || 0) - (plData?.totalCOGS || 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <div className="flex items-center justify-between mb-12 pb-6 border-b-4 border-slate-200 dark:border-slate-800">
                                                <h3 className="text-sm font-black uppercase tracking-[0.5em] text-slate-400 italic">03. INDIRECT ADMIN COST</h3>
                                                <span className="text-2xl font-black text-rose-500 tracking-tighter">({formatCurrency(plData?.totalExpenses || 0)})</span>
                                            </div>
                                            <div className="space-y-6">
                                                {plData?.expenses?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between items-end pb-4 border-b border-dotted border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">{item.name}</span>
                                                        <div className="flex-1 mx-6 border-b border-dotted border-slate-100 dark:border-slate-800 mb-1" />
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">({formatCurrency(item.amount)})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <div className="py-20 border-t-8 border-slate-900 dark:border-white flex flex-col md:flex-row justify-between items-center gap-10">
                                            <div>
                                                <h4 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">The Bottom Line</h4>
                                                <p className="text-slate-400 font-bold tracking-[0.3em] uppercase text-xs mt-2">Aggregated Net Operating Performance</p>
                                            </div>
                                            <span className={`text-8xl font-black tracking-tighter ${plData?.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                {formatCurrency(plData?.netProfit || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeModernTab === 'bs' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 outline-none">
                                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border-none overflow-hidden h-full flex flex-col">
                                        <div className="bg-emerald-600 p-12 text-white relative overflow-hidden h-[320px] shrink-0">
                                            <div className="absolute top-0 right-0 p-10 opacity-20 rotate-12 scale-150">
                                                <Wallet size={150} strokeWidth={1} />
                                            </div>
                                            <div className="relative z-10 flex flex-col h-full justify-between">
                                                <Badge className="bg-white/10 text-white border-none w-fit px-4 py-1 uppercase text-[10px] tracking-widest font-black">Audit Class Assets</Badge>
                                                <div>
                                                    <h3 className="text-4xl font-black tracking-tighter mb-2 italic underline underline-offset-[1rem]">Total Enterprise Ownership</h3>
                                                    <p className="text-emerald-100 font-bold text-sm tracking-wide">Aggregated Liquid and Fixed Corporate Assets</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-12 space-y-6 flex-1 bg-slate-50/50 dark:bg-slate-950/20">
                                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-6 border border-slate-100 dark:border-slate-800">
                                                {bsData?.assets?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between items-center py-5 border-b border-slate-50 dark:border-slate-800/20 last:border-0 group">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1">{item.type || 'ASSET'}</p>
                                                            <p className="font-black text-slate-800 dark:text-slate-100 italic transition-colors group-hover:text-indigo-600">{item.name}</p>
                                                        </div>
                                                        <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="pt-10 mt-10 border-t-4 border-emerald-600 flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600 italic">Consolidated Asset Integrity</span>
                                                    <span className="text-5xl font-black tracking-tighter text-emerald-600">{formatCurrency(bsData?.totalAssets || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border-none overflow-hidden h-full flex flex-col">
                                        <div className="bg-slate-900 p-12 text-white relative overflow-hidden h-[320px] shrink-0">
                                            <div className="absolute top-0 right-0 p-10 opacity-20 -rotate-12 scale-150">
                                                <Landmark size={150} strokeWidth={1} />
                                            </div>
                                            <div className="relative z-10 flex flex-col h-full justify-between">
                                                <Badge className="bg-white/10 text-white border-none w-fit px-4 py-1 uppercase text-[10px] tracking-widest font-black">Claims & Reserves</Badge>
                                                <div>
                                                    <h3 className="text-4xl font-black tracking-tighter mb-2 italic underline underline-offset-[1rem]">Liabilities & Capitalization</h3>
                                                    <p className="text-slate-500 font-bold text-sm tracking-wide">Full spectrum of structural debt and institutional equity.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-12 space-y-12 flex-1 bg-slate-50/50 dark:bg-slate-950/20">
                                             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-12 border border-slate-100 dark:border-slate-800">
                                                <section>
                                                    <div className="flex items-center gap-4 mb-8">
                                                        <div className="p-3 bg-rose-600/10 rounded-2xl">
                                                            <History className="h-5 w-5 text-rose-500" />
                                                        </div>
                                                        <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-[0.3em] italic">Current Accounts Payable</h4>
                                                    </div>
                                                    <div className="space-y-6">
                                                        {bsData?.liabilities?.map((item: any) => (
                                                            <div key={item.name} className="flex justify-between py-3 border-b border-dotted border-slate-50 dark:border-slate-800/20">
                                                                <span className="font-bold text-slate-500 dark:text-slate-400 italic text-sm">{item.name}</span>
                                                                <span className="font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(item.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>

                                                <section>
                                                    <div className="flex items-center gap-4 mb-8">
                                                        <div className="p-3 bg-indigo-600/10 rounded-2xl">
                                                            <ShieldCheck className="h-5 w-5 text-indigo-500" />
                                                        </div>
                                                        <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] italic">Proprietor's Resilience</h4>
                                                    </div>
                                                    <div className="space-y-6">
                                                        {bsData?.equity?.map((item: any) => (
                                                            <div key={item.name} className="flex justify-between py-3 border-b border-dotted border-slate-50 dark:border-slate-800/20">
                                                                <span className="font-bold text-slate-500 dark:text-slate-400 italic text-sm">{item.name}</span>
                                                                <span className="font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(item.amount)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="pt-6 border-t-2 border-indigo-600 flex justify-between items-center text-indigo-600">
                                                            <span className="text-[10px] font-black uppercase tracking-widest italic">Retained Corporate Earnings</span>
                                                            <span className="text-xl font-black tracking-tighter">{formatCurrency(bsData?.retainedEarnings || 0)}</span>
                                                        </div>
                                                    </div>
                                                </section>

                                                <div className="pt-10 border-t-8 border-slate-900 dark:border-white">
                                                    <div className="flex justify-between items-center group">
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 block mb-1">Total Fiscal Footprint</span>
                                                            <div className="w-12 h-1.5 bg-indigo-600 group-hover:w-32 transition-all duration-700" />
                                                        </div>
                                                        <span className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white transition-transform group-hover:scale-110 duration-700">
                                                            {formatCurrency((bsData?.totalLiabilities || 0) + (bsData?.totalEquity || 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
