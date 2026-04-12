'use client'

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { Card } from "@/components/ui/card"
import {
    TrendingUp, Users, Calendar, IndianRupee,
    ArrowUpRight, ArrowDownRight, Activity, Filter, Download
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

export function AnalyticsClient({ data }: { data: any }) {
    const { revenueData, appointmentData, topDoctors, genderData, categoryData, stats } = data

    const handleExportCSV = () => {
        if (!categoryData || categoryData.length === 0) return;

        const headers = ["Product Group", "Revenue (INR)", "Transactions", "Percentage Share"];
        const total = categoryData.reduce((sum: number, i: any) => sum + i.value, 0);
        
        const rows = categoryData.map((item: any) => [
            item.name,
            item.value,
            item.count,
            `${Math.round((item.value / (total || 1)) * 100)}%`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any[]) => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `groupwise_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                        Hospital Analytics <span className="text-indigo-600">Pro</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Data-driven insights for strategic hospital management.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all text-emerald-600"
                    >
                        <Download className="h-4 w-4" /> Download CSV
                    </button>
                    <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all">
                        Generate PDF Report
                    </button>
                </div>
            </div>

            {/* Top KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Patients"
                    value={stats.totalPatients}
                    icon={Users}
                    trend="+12%"
                    isUp={true}
                    color="blue"
                />
                <MetricCard
                    title="Total Appointments"
                    value={stats.totalAppointments}
                    icon={Calendar}
                    trend="+5%"
                    isUp={true}
                    color="indigo"
                />
                <MetricCard
                    title="Clinical Efficiency"
                    value="94%"
                    icon={Activity}
                    trend="+2%"
                    isUp={true}
                    color="emerald"
                />
                <MetricCard
                    title="Total Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString()}`}
                    icon={IndianRupee}
                    trend="+18%"
                    isUp={true}
                    color="orange"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Revenue Trend - Area Chart */}
                <Card className="lg:col-span-8 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-indigo-500" /> Revenue Trend
                            </h3>
                            <p className="text-xs text-slate-400">Monthly financial performance</p>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(value) => `₹${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#6366f1"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRev)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Groupwise Sales Breakdown - Pie Chart */}
                <Card className="lg:col-span-4 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative group">
                     {/* Decorative light reflection */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                    
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-lg">
                                <Activity className="h-6 w-6 text-emerald-500" /> Groupwise Sales Report
                            </h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-indigo-500 italic">Revenue by Product Group</p>
                        </div>
                    </div>

                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    animationDuration={1500}
                                    stroke="none"
                                >
                                    {categoryData.map((entry: any, index: number) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={COLORS[index % COLORS.length]}
                                            className="hover:opacity-80 transition-opacity cursor-pointer shadow-xl" 
                                        />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    formatter={(val: any) => `₹${Number(val).toLocaleString()}`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <AnimatePresence>
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center"
                                >
                                    <TrendingUp className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Gross Yield</div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                    
                    <div className="mt-8 space-y-4 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {categoryData.map((entry: any, index: number) => {
                            const total = categoryData.reduce((sum: number, i: any) => sum + i.value, 0);
                            const percent = Math.round((entry.value / (total || 1)) * 100);
                            
                            return (
                                <div key={entry.name} className="flex items-center justify-between group/row">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight group-hover/row:text-indigo-600 transition-colors">{entry.name}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{entry.count} Transactions</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-slate-900 dark:text-white block">₹{entry.value.toLocaleString()}</span>
                                        <span className="text-[10px] font-bold text-emerald-500">{percent}% Share</span>
                                    </div>
                                </div>
                            );
                        })}
                        {categoryData.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-xs text-slate-400 italic font-medium">Categorizing incoming streams...</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointment Volume */}
                <Card className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Appointment Volume</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={appointmentData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                                <Bar dataKey="appointments" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top Doctors */}
                <Card className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Top Performing Doctors</h3>
                    <div className="space-y-6">
                        {topDoctors.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-indigo-600">
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{doc.name}</span>
                                        <span className="text-xs font-black text-indigo-600">{doc.count} Cases</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(doc.count / (topDoctors[0]?.count || 1)) * 100}%` }}
                                            transition={{ duration: 1, delay: i * 0.1 }}
                                            className="h-full bg-indigo-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {topDoctors.length === 0 && <p className="text-center py-10 text-slate-400 italic">No data available for this period.</p>}
                    </div>
                </Card>
            </div>
        </div>
    )
}

function MetricCard({ title, value, customValue, icon: Icon, trend, isUp, color }: any) {
    const bgColors = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    } as any

    return (
        <Card className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${bgColors[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-black uppercase px-2 py-1 rounded-full ${isUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {customValue || value}
                </h3>
            </div>
        </Card>
    )
}
