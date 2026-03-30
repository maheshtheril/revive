'use client';

import { useEffect, useState } from 'react';
import { getPharmacyStockSummary } from '@/app/actions/pharmacy';
import { 
    Package, AlertTriangle, Clock, Search, 
    Filter, Database, ChevronRight, Plus,
    FileText, ArrowDown, ArrowUp, BarChart3,
    Calendar, MoreVertical, RefreshCcw
} from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PharmacyInventoryPage() {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'LOW' | 'EXPIRING' | 'OUT'>('ALL');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const res = await getPharmacyStockSummary();
        if (res.success) {
            setData(res.data || []);
            setStats(res.stats);
        }
        setIsLoading(false);
    }

    const filteredData = data.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                             item.sku.toLowerCase().includes(search.toLowerCase());
        
        if (filter === 'LOW') return matchesSearch && item.isLow && item.totalStock > 0;
        if (filter === 'EXPIRING') {
            const thirtyDays = addDays(new Date(), 30);
            return matchesSearch && item.soonestExpiry && isBefore(new Date(item.soonestExpiry), thirtyDays);
        }
        if (filter === 'OUT') return matchesSearch && item.totalStock <= 0;
        
        return matchesSearch;
    });

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col p-4 md:p-8 space-y-8 overflow-hidden animate-in fade-in duration-700">
            {/* Header / Stats Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Pharmacy Inventory</h1>
                    <p className="text-slate-500 mt-2 font-bold flex items-center gap-2">
                        <Badge variant="outline" className="border-indigo-100 text-indigo-600 uppercase font-bold text-[10px] tracking-widest">Live Stock Levels</Badge>
                        <span>• {format(new Date(), 'dd-MMMM-yyyy').toUpperCase()}</span>
                    </p>
                </div>

                <div className="flex gap-4">
                    <Button variant="outline" className="h-12 px-6 rounded-2xl bg-white border-slate-200 shadow-sm font-black text-[10px] tracking-widest transition-all hover:scale-105 active:scale-95" onClick={loadData}>
                        <RefreshCcw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> REFRESH
                    </Button>
                    <Button className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] tracking-widest shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95">
                        <Plus className="h-4 w-4 mr-2" /> NEW PRODUCT
                    </Button>
                </div>
            </div>

            {/* Analytic Cards - Tally Inspired Modern Look */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'TOTAL DRUGS', val: stats?.totalItems || 0, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50', filter: 'ALL' },
                    { label: 'LOW STOCK', val: stats?.lowStockItems || 0, icon: Database, color: 'text-amber-600', bg: 'bg-amber-50', filter: 'LOW' },
                    { label: 'EXPIRING SOON', val: stats?.expiringSoon || 0, icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50', filter: 'EXPIRING' },
                    { label: 'OUT OF STOCK', val: stats?.outOfStock || 0, icon: AlertTriangle, color: 'text-slate-900', bg: 'bg-slate-200', filter: 'OUT' },
                ].map((s, i) => (
                    <button 
                        key={i} 
                        onClick={() => setFilter(s.filter as any)}
                        className={cn(
                            "p-6 rounded-[2.5rem] border transition-all flex flex-col justify-between h-40 text-left relative overflow-hidden group",
                            filter === s.filter ? "bg-white border-indigo-200 shadow-xl scale-105 z-10" : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 shadow-sm"
                        )}
                    >
                        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", s.bg)}>
                            <s.icon className={cn("h-6 w-6", s.color)} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
                            <h3 className="text-3xl font-black text-slate-900 mt-1">{s.val}</h3>
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Inventory Controller */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col flex-1 overflow-hidden min-h-0">
                {/* Control Bar */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl w-full md:w-96">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by Medicine Name or SKU..." 
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full"
                        />
                    </div>
                </div>

                {/* Stock Table */}
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    <table className="w-full border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-3 text-left">Medicine Name</th>
                                <th className="px-6 py-3 text-left">SKU</th>
                                <th className="px-6 py-3 text-left">Total Stock</th>
                                <th className="px-6 py-3 text-left">Soonest Expiry</th>
                                <th className="px-6 py-3 text-left">Status</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item, i) => (
                                <tr key={i} className="group hover:bg-slate-50 transition-colors rounded-3xl cursor-pointer">
                                    <td className="px-6 py-5 bg-white border-y border-l border-slate-50 rounded-l-3xl first-of-type:border-l">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs ring-2 ring-transparent group-hover:ring-indigo-100 transition-all">
                                                {item.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 uppercase tracking-tight">{item.name}</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">UOM: {item.uom}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 bg-white border-y border-slate-50">
                                        <code className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">{item.sku}</code>
                                    </td>
                                    <td className="px-6 py-5 bg-white border-y border-slate-50 font-black text-lg">
                                        {item.totalStock}
                                    </td>
                                    <td className="px-6 py-5 bg-white border-y border-slate-50">
                                        {item.soonestExpiry ? (
                                            <div className={cn(
                                                "text-[10px] font-black uppercase flex items-center gap-2",
                                                isBefore(new Date(item.soonestExpiry), addDays(new Date(), 30)) ? "text-rose-500" : "text-emerald-500"
                                            )}>
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(item.soonestExpiry), 'MMM yyyy').toUpperCase()}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 bg-white border-y border-slate-50">
                                        {item.totalStock <= 0 ? (
                                            <Badge className="bg-slate-900/10 text-slate-900 border-none uppercase font-black text-[8px] tracking-widest px-3 py-1">Out of Stock</Badge>
                                        ) : item.isLow ? (
                                            <Badge className="bg-amber-100 text-amber-600 border-none uppercase font-black text-[8px] tracking-widest px-3 py-1">Low Stock</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-100 text-emerald-600 border-none uppercase font-black text-[8px] tracking-widest px-3 py-1">Optimal</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 bg-white border-y border-r border-slate-50 rounded-r-3xl text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600">
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredData.length === 0 && (
                        <div className="py-32 text-center">
                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Database className="h-10 w-10 text-slate-200" />
                            </div>
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Matching Inventory</h3>
                            <p className="text-slate-300 text-xs mt-2 italic">Try search by drug name or adjustment of filters.</p>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="h-12 bg-slate-900 flex items-center justify-between px-8 text-white text-[10px] font-black uppercase tracking-widest">
                    <div className="flex gap-8">
                        <span className="text-slate-400">STATUS: <span className="text-emerald-400">SYNCED</span></span>
                        <span className="text-slate-400">DATABASE: <span className="text-indigo-400">NEON-POSTGRES</span></span>
                    </div>
                    <div className="flex gap-4">
                        <span>F10: REPORTS</span>
                        <span>F12: SETTINGS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
