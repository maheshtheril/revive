'use client'

import { useState, useEffect } from 'react'
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
import {
    getDailyAccountingSummary,
    getProfitAndLossStatement,
    getBalanceSheetStatement,
    getFinancialTrends,
    getExecutiveInsights
} from "@/app/actions/accounting/reports"
import { ClassicProfitLoss } from "./classic-profit-loss"
import { ClassicBalanceSheet } from "./classic-balance-sheet"
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

// Dynamically import Recharts to avoid hydration errors (SSR: False)
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })

function CountUp({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) {
    const { formatNumber } = useLocalization();
    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {prefix}{formatNumber(value, 0)}{suffix}
        </motion.span>
    )
}

export function FinancialDashboard({
    currencyCode = 'INR',
    currencySymbol = '₹'
}: {
    currencyCode?: string,
    currencySymbol?: string
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [dailyData, setDailyData] = useState<any>(null)
    const [plData, setPlData] = useState<any>(null)
    const [bsData, setBsData] = useState<any>(null)
    const [trends, setTrends] = useState<any[]>([])
    const [insights, setInsights] = useState<string[]>([])
    const [date, setDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<'modern' | 'classic'>('modern')
    const [classicTab, setClassicTab] = useState<'pl' | 'bs'>('pl')

    useEffect(() => {
        loadData()
    }, [date])

    async function loadData() {
        setLoading(true)
        try {
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

            const [daily, pl, bs, trendRes, insightRes] = await Promise.all([
                getDailyAccountingSummary(date),
                getProfitAndLossStatement(startOfMonth, endOfMonth),
                getBalanceSheetStatement(date),
                getFinancialTrends(),
                getExecutiveInsights()
            ])

            if (daily.success) setDailyData(daily.data)
            if (pl.success) setPlData(pl.data)
            if (bs.success) setBsData(bs.data)
            if (trendRes.success) setTrends(trendRes.data || [])
            if (insightRes.success) setInsights((insightRes as any).data || [])
        } catch (error) {
            console.error("Failed to load dashboard data", error)
        }
        setLoading(false)
    }

    const { formatDate, formatCurrency } = useLocalization()

    if (loading && !dailyData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                    <RefreshCcw className="h-12 w-12 text-indigo-500" />
                </motion.div>
                <p className="text-slate-500 animate-pulse font-medium">Synthesizing Financial Intelligence...</p>
            </div>
        )
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, staggerChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-8 p-4 md:p-8 pb-20 max-w-[1600px] mx-auto"
        >
            {/* Premium Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-indigo-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl font-inter" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Real-time Intelligence
                        </Badge>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                        Financial <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Intelligence</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Comprehensive performance control & fiscal oversight</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <Button
                        variant={viewMode === 'classic' ? 'default' : 'outline'}
                        onClick={() => setViewMode(viewMode === 'modern' ? 'classic' : 'modern')}
                        className={`h-12 px-6 rounded-xl border-slate-200 dark:border-slate-800 gap-2 transition-all font-bold ${viewMode === 'classic' ? 'bg-[#002b2b] text-[#ffffcc] hover:bg-[#004d4d]' : 'hover:bg-slate-50'}`}
                    >
                        <Landmark className="h-5 w-5" />
                        {viewMode === 'modern' ? 'Switch to Tally View' : 'Back to Dashboard'}
                    </Button>
                    <Button variant="outline" className="h-12 px-6 rounded-xl border-slate-200 dark:border-slate-800 gap-2 hover:bg-slate-50 transition-all font-semibold">
                        <Calendar className="h-5 w-5 text-indigo-500" />
                        {formatDate(date, 'MMMM yyyy')}
                    </Button>
                    <Button className="h-12 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all gap-2 font-bold shadow-xl shadow-slate-900/10 dark:shadow-white/5">
                        <Download className="h-5 w-5" /> Executive Report
                    </Button>
                </div>
            </div>

            {/* Core KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div variants={itemVariants}>
                    <Card className="group relative overflow-hidden border-none shadow-2xl shadow-indigo-500/10 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-[2rem] h-full">
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
                            <TrendingUp size={80} strokeWidth={1} />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-indigo-100/80 font-bold uppercase tracking-[0.15em] text-[10px]">Today's Gross Sales</CardDescription>
                            <CardTitle className="text-4xl font-black">
                                <CountUp value={dailyData?.totalSales || 0} prefix={currencySymbol} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs backdrop-blur-md bg-white/10 w-fit px-3 py-1.5 rounded-full">
                                <span className={`flex items-center font-bold ${dailyData?.deltas?.sales >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {dailyData?.deltas?.sales >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {Math.abs(dailyData?.deltas?.sales || 0).toFixed(1)}%
                                </span>
                                <span className="text-indigo-100/60 font-medium">vs yesterday</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-lg hover:shadow-xl transition-all h-full">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                            <ShieldCheck size={80} strokeWidth={1} />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-[0.15em] text-[10px] text-slate-400">Recovery Efficiency</CardDescription>
                            <CardTitle className="text-4xl font-black text-slate-900 dark:text-white">
                                <CountUp value={Math.round((dailyData?.totalPaid / (dailyData?.totalSales || 1)) * 100)} suffix="%" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-1">
                                <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                                    <ArrowUpRight className="h-4 w-4" />
                                    <CountUp value={dailyData?.totalPaid || 0} prefix={currencySymbol} /> Collected
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden px-0.5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (dailyData?.totalPaid / (dailyData?.totalSales || 1)) * 100)}%` }}
                                        transition={{ duration: 1.5, ease: "circOut" }}
                                        className="h-1 mt-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-lg hover:shadow-xl transition-all h-full">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-600 group-hover:scale-110 transition-transform duration-500">
                            <Zap size={80} strokeWidth={1} />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-[0.15em] text-[10px] text-slate-400">Total Outflow</CardDescription>
                            <CardTitle className="text-4xl font-black text-rose-500">
                                <CountUp value={dailyData?.totalPurchases || 0} prefix={currencySymbol} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Liabilities cleared & procurement expenses recorded today.
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-lg hover:shadow-xl transition-all h-full">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                            <Layers size={80} strokeWidth={1} />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="font-bold uppercase tracking-[0.15em] text-[10px] text-slate-400">Net Monthly margin</CardDescription>
                            <CardTitle className={`text-4xl font-black ${plData?.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                <CountUp value={plData?.netProfit || 0} prefix={currencySymbol} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border-none font-bold">
                                {((plData?.netProfit / (plData?.totalRevenue || 1)) * 100).toFixed(1)}% Profit Margin
                            </Badge>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Main Content Area: Trends & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Trend Chart */}
                <Card className="lg:col-span-8 border-none shadow-2xl shadow-indigo-500/5 bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800/50">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Performance Velocity</CardTitle>
                                <CardDescription className="text-slate-500">Revenue vs Expense trend (30-day window)</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Revenue</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Expense</span>
                                </div>
                            </div>
                        </div>

                        {/* Intelligence Summary Layer */}
                        <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="h-4 w-4 text-indigo-600" />
                                <span className="font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-[10px]">Neural Executive Summary</span>
                            </div>
                            <div className="space-y-2">
                                {insights.length > 0 ? insights.map((insight, idx) => (
                                    <div key={idx} className="flex gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed group">
                                        <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0 group-hover:scale-150 transition-transform" />
                                        <p>{insight}</p>
                                    </div>
                                )) : (
                                    <p className="text-xs text-slate-500 animate-pulse">Scanning financial neural patterns...</p>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 h-[350px]">
                        {trends.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trends} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888810" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => `${currencySymbol}${val / 1000}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                            borderRadius: '1.5rem',
                                            border: 'none',
                                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                            padding: '1rem'
                                        }}
                                        cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4 4' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#6366f1"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorRev)"
                                        animationDuration={2000}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="expense"
                                        stroke="#f43f5e"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorExp)"
                                        animationDuration={2000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Action Control Hub */}
                <Card className="lg:col-span-4 border-none shadow-2xl shadow-indigo-500/5 bg-slate-900 text-white rounded-[2.5rem] overflow-hidden flex flex-col h-full">
                    <CardHeader className="p-8">
                        <CardTitle className="text-2xl font-black">Control Hub</CardTitle>
                        <CardDescription className="text-slate-400">Mission-critical accounting operations</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-4 flex-1">
                        <Button
                            onClick={() => router.push('/hms/accounting/journals/new')}
                            className="w-full h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl justify-between px-6 border border-white/10 group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-indigo-500/20 rounded-xl group-hover:bg-indigo-500/30 transition-colors">
                                    <Receipt className="h-5 w-5 text-indigo-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Post Journal Entry</p>
                                    <p className="text-[10px] text-slate-400">Manual adjusting entries (F7)</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <Button
                            onClick={() => router.push('/hms/accounting/payments/new')}
                            className="w-full h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl justify-between px-6 border border-white/5 group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/20 rounded-xl group-hover:bg-emerald-500/30 transition-colors">
                                    <CreditCard className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Voucher Payment (F5)</p>
                                    <p className="text-[10px] text-slate-400">Record cash/bank outflow</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <Button
                            onClick={() => router.push('/hms/accounting/receipts/new')}
                            className="w-full h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl justify-between px-6 border border-white/5 group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                                    <History className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Voucher Receipt (F6)</p>
                                    <p className="text-[10px] text-slate-400">Incoming cash/bank flow</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <Button
                            onClick={() => router.push('/hms/accounting/coa')}
                            className="w-full h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl justify-between px-6 border border-white/10 group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-amber-500/20 rounded-xl group-hover:bg-amber-500/30 transition-colors">
                                    <Layers className="h-5 w-5 text-amber-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Chart of Accounts</p>
                                    <p className="text-[10px] text-slate-400">Structure & ledger management</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                        </Button>


                        <div className="mt-4 pt-4 border-t border-white/10">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4 text-center">Audit & Oversight</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push('/hms/accounting/daybook')}
                                    className="flex flex-col h-20 bg-white/5 hover:bg-white/10 rounded-2xl gap-2 border border-white/5"
                                >
                                    <FileText className="h-4 w-4 text-indigo-400" />
                                    <span className="text-[10px] font-bold">Daybook</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push('/hms/accounting/cashbook')}
                                    className="flex flex-col h-20 bg-white/5 hover:bg-white/10 rounded-2xl gap-2 border border-white/5"
                                >
                                    <Banknote className="h-4 w-4 text-emerald-400" />
                                    <span className="text-[10px] font-bold">Cashbook</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push('/hms/accounting/bankbook')}
                                    className="flex flex-col h-20 bg-white/5 hover:bg-white/10 rounded-2xl gap-2 border border-white/5"
                                >
                                    <CreditCard className="h-4 w-4 text-blue-400" />
                                    <span className="text-[10px] font-bold">Bankbook</span>
                                </Button>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4 text-center">Cash On Hand Position</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                                    <Banknote className="h-4 w-4 mx-auto mb-2 text-emerald-400" />
                                    <p className="text-[10px] text-slate-400 font-bold mb-1">Cash Balance</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(bsData?.assets?.find((a: any) => a.name === 'Cash on Hand')?.amount || 0)}</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                                    <Landmark className="h-4 w-4 mx-auto mb-2 text-indigo-400" />
                                    <p className="text-[10px] text-slate-400 font-bold mb-1">Bank Position</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(bsData?.assets?.find((a: any) => a.name === 'Bank Account')?.amount || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {viewMode === 'classic' ? (
                <div className="animate-in fade-in zoom-in duration-500 space-y-4">
                    <div className="flex bg-[#003333] p-1 rounded-lg border border-[#004d4d] w-fit mx-auto self-center no-print sticky top-4 z-[100] shadow-2xl">
                        <button
                            onClick={() => setClassicTab('pl')}
                            className={`px-8 py-2 text-xs font-black uppercase transition-all tracking-widest ${classicTab === 'pl' ? 'bg-[#ffffcc] text-black shadow-lg shadow-black/20' : 'text-[#64ffff] hover:bg-[#004d4d]'}`}
                        >
                            Profit & Loss Account
                        </button>
                        <button
                            onClick={() => setClassicTab('bs')}
                            className={`px-8 py-2 text-xs font-black uppercase transition-all tracking-widest ${classicTab === 'bs' ? 'bg-[#ffffcc] text-black shadow-lg shadow-black/20' : 'text-[#64ffff] hover:bg-[#004d4d]'}`}
                        >
                            Balance Sheet
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
                <Tabs defaultValue="pl" className="w-full">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-[2rem]">
                    <TabsList className="bg-transparent gap-2 h-auto p-0">
                        <TabsTrigger
                            value="daily"
                            className="rounded-2xl px-8 h-12 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest"
                        >
                            Daily Streams
                        </TabsTrigger>
                        <TabsTrigger
                            value="pl"
                            className="rounded-2xl px-8 h-12 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest"
                        >
                            Profit & Loss
                        </TabsTrigger>
                        <TabsTrigger
                            value="bs"
                            className="rounded-2xl px-8 h-12 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg font-bold text-xs uppercase tracking-widest"
                        >
                            Balance Sheet
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 px-4">
                        <History className="h-4 w-4 text-slate-400" />
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Audited Statement Mode</span>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Daily Streams */}
                    <TabsContent value="daily">
                        <motion.div
                            key="daily"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                        >
                            <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
                                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-8">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
                                                <TrendingUp className="h-5 w-5 text-white" />
                                            </div>
                                            Revenue Breakdown
                                        </CardTitle>
                                        <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-none font-black px-4 py-1">INCOME</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Object.entries(dailyData?.revenueByAccount || {}).length > 0 ? (
                                            Object.entries(dailyData?.revenueByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                <div key={acc} className="group flex items-center justify-between p-6 px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{acc}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-slate-900 dark:text-white text-lg">{formatCurrency(amt)}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{((amt / (dailyData?.totalSales || 1)) * 100).toFixed(1)}% share</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-20 text-center">
                                                <TrendingUp className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                                <p className="text-slate-400 font-medium italic">No revenue activity recorded in the selected period</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[2.5rem] border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
                                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-8">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl flex items-center gap-3">
                                            <div className="p-2 bg-rose-500 rounded-xl shadow-lg shadow-rose-500/20">
                                                <TrendingDown className="h-5 w-5 text-white" />
                                            </div>
                                            Expense Breakdown
                                        </CardTitle>
                                        <Badge variant="secondary" className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-none font-black px-4 py-1">OUTFLOW</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Object.entries(dailyData?.expenseByAccount || {}).length > 0 ? (
                                            Object.entries(dailyData?.expenseByAccount || {}).map(([acc, amt]: [any, any]) => (
                                                <div key={acc} className="group flex items-center justify-between p-6 px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{acc}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-rose-500 text-lg">{formatCurrency(amt)}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Operating Cost</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-20 text-center">
                                                <TrendingDown className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                                <p className="text-slate-400 font-medium italic">Full resource availability - No expenses recorded</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </TabsContent>

                    {/* Profit & Loss Statement */}
                    <TabsContent value="pl">
                        <motion.div
                            key="pl"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="p-12 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8 bg-slate-50 dark:bg-slate-900/50">
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Statement of Profit or Loss</h2>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <Badge variant="outline" className="text-indigo-600 bg-white border-indigo-200 font-bold">ACCRAUAL BASIS</Badge>
                                        <span className="text-slate-400 text-sm font-medium">Period ending {date.toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl text-center min-w-[280px] relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-2 h-full ${plData?.netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Net Corporate Profit</p>
                                    <p className={`text-4xl font-black ${plData?.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(plData?.netProfit || 0)}
                                    </p>
                                    {plData?.netProfit > 0 && <div className="mt-2 text-[10px] font-bold text-emerald-500 animate-pulse">POSITIVE FISCAL FLOW</div>}
                                </div>
                            </div>

                            <div className="max-w-4xl mx-auto py-16 px-8 lg:px-0 space-y-16">
                                {/* Revenue */}
                                <section>
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-slate-900 dark:border-white">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">01. Revenue Streams</h3>
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(plData?.totalRevenue || 0)}</span>
                                    </div>
                                    <div className="space-y-4">
                                        {plData?.revenue?.map((item: any) => (
                                            <div key={item.name} className="flex justify-between items-end pb-3 border-b border-slate-50 dark:border-slate-800/50 group">
                                                <span className="text-slate-600 dark:text-slate-400 font-medium group-hover:text-indigo-500 transition-colors uppercase tracking-widest text-[11px]">{item.name}</span>
                                                <div className="flex-1 border-b border-dotted border-slate-200 dark:border-slate-800 mx-4 mb-1" />
                                                <span className="font-black text-slate-900 dark:text-white">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* COGS */}
                                <section>
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-slate-200 dark:border-slate-800">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">02. Direct Operating Costs</h3>
                                        <span className="font-bold text-rose-500">({formatCurrency(plData?.totalCOGS || 0)})</span>
                                    </div>
                                    <div className="space-y-4">
                                        {plData?.cogs?.map((item: any) => (
                                            <div key={item.name} className="flex justify-between items-end pb-3 border-b border-slate-50 dark:border-slate-800/50 group">
                                                <span className="text-slate-600 dark:text-slate-400 font-medium group-hover:text-rose-500 transition-colors uppercase tracking-widest text-[11px]">{item.name}</span>
                                                <div className="flex-1 border-b border-dotted border-slate-200 dark:border-slate-800 mx-4 mb-1" />
                                                <span className="font-bold text-slate-700 dark:text-slate-300">({formatCurrency(item.amount)})</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center py-6 mt-4 bg-emerald-50 dark:bg-emerald-900/10 px-8 rounded-[1.5rem] border border-emerald-100 dark:border-emerald-900/50">
                                            <span className="font-black text-emerald-900 dark:text-emerald-400 text-sm tracking-widest uppercase">Gross Profit Margin</span>
                                            <span className="text-2xl font-black text-emerald-600">
                                                {formatCurrency((plData?.totalRevenue || 0) - (plData?.totalCOGS || 0))}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {/* Expenses */}
                                <section>
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-slate-200 dark:border-slate-800">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">03. Indirect / Admin Expenses</h3>
                                        <span className="font-bold text-rose-500">({formatCurrency(plData?.totalExpenses || 0)})</span>
                                    </div>
                                    <div className="space-y-4">
                                        {plData?.expenses?.map((item: any) => (
                                            <div key={item.name} className="flex justify-between items-end pb-3 border-b border-slate-50 dark:border-slate-800/50">
                                                <span className="text-slate-600 dark:text-slate-400 font-medium uppercase tracking-widest text-[11px]">{item.name}</span>
                                                <div className="flex-1 border-b border-dotted border-slate-200 dark:border-slate-800 mx-4 mb-1" />
                                                <span className="font-bold text-slate-700 dark:text-slate-300">({formatCurrency(item.amount)})</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="py-12 border-t-8 border-slate-900 dark:border-white">
                                    <div className="flex justify-between items-center px-4">
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Earnings Before Interest & Tax</h4>
                                            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] mt-1">THE BOTTOM LINE PERFORMANCE</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-6xl font-black tracking-tighter ${plData?.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                {formatCurrency(plData?.netProfit || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </TabsContent>

                    {/* Balance Sheet Statement */}
                    <TabsContent value="bs">
                        <motion.div
                            key="bs"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                        >
                            <Card className="rounded-[3rem] border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-900 h-full">
                                <CardHeader className="bg-emerald-500 text-white p-10 h-48 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-10 opacity-20">
                                        <Wallet size={120} strokeWidth={1} />
                                    </div>
                                    <div className="relative z-10">
                                        <CardTitle className="text-3xl font-black mb-1">Total Enterprise Assets</CardTitle>
                                        <CardDescription className="text-emerald-100 font-bold">What the corporation owns</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 -mt-10 relative z-20">
                                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl p-8 space-y-6">
                                        {bsData?.assets?.map((item: any) => (
                                            <div key={item.name} className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{item.type || 'ASSET'}</p>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                                                </div>
                                                <span className="font-black text-xl text-slate-900 dark:text-white">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="pt-6 mt-6 border-t-2 border-emerald-100 dark:border-emerald-900/50 flex justify-between items-center">
                                            <span className="text-sm font-black uppercase tracking-widest text-emerald-600">Total Liquid Assets</span>
                                            <span className="text-4xl font-black text-emerald-600">{formatCurrency(bsData?.totalAssets || 0)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[3rem] border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-900 h-full">
                                <CardHeader className="bg-slate-900 text-white p-10 h-48 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-10 opacity-20">
                                        <Landmark size={120} strokeWidth={1} />
                                    </div>
                                    <div className="relative z-10">
                                        <CardTitle className="text-3xl font-black mb-1">Liabilities & Equity</CardTitle>
                                        <CardDescription className="text-slate-400 font-bold">Claims against the corporation</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 -mt-10 relative z-20">
                                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl p-8 space-y-10">
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="bg-rose-500/10 p-2 rounded-lg">
                                                    <History className="h-4 w-4 text-rose-500" />
                                                </div>
                                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Accounts Payable & Liabilities</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {bsData?.liabilities?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800/20 last:border-0">
                                                        <span className="font-medium text-slate-600 dark:text-slate-400">{item.name}</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="bg-indigo-500/10 p-2 rounded-lg">
                                                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                                                </div>
                                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Proprietor's Equity / Reserves</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {bsData?.equity?.map((item: any) => (
                                                    <div key={item.name} className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800/20 last:border-0">
                                                        <span className="font-medium text-slate-600 dark:text-slate-400">{item.name}</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between py-3 border-t border-indigo-100 dark:border-indigo-900/50 italic text-indigo-500 font-black">
                                                    <span className="text-xs uppercase tracking-widest font-black">Retained Earnings</span>
                                                    <span>{formatCurrency(bsData?.retainedEarnings || 0)}</span>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="pt-6 mt-6 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center group">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Capital Employed</span>
                                                <div className="w-12 h-1 bg-slate-900 dark:bg-white transition-all group-hover:w-24" />
                                            </div>
                                            <span className="text-4xl font-black text-slate-900 dark:text-white">
                                                {formatCurrency((bsData?.totalLiabilities || 0) + (bsData?.totalEquity || 0))}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </TabsContent>
                </AnimatePresence>
            </Tabs>
            )}
        </motion.div>
    )
}
