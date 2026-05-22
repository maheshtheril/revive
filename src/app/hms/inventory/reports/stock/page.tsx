'use client';

import { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    FileDown,
    RefreshCw,
    ArrowLeft,
    ArrowRight,
    TrendingUp,
    Package,
    AlertTriangle,
    Clock,
    ChevronDown,
    Save,
    CheckSquare,
    Square,
    MoreVertical,
    BarChart3,
    DollarSign,
    Box,
    Edit3,
    X,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    getStockReport,
    bulkUpdateBatchPricing,
    getCategories,
    exportStockReportToExcel
} from '@/app/actions/inventory';
import { 
    repairStockQuantities, 
    repairMissingPrices 
} from '@/app/actions/stock-healer';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function StockReportPremium() {
    const router = useRouter();

    // State
    const [loading, setLoading] = useState(true);
    const [healing, setHealing] = useState(false);
    const [priceHealing, setPriceHealing] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>({
        total: 0,
        page: 1,
        totalPages: 1,
        globalSummary: {
            totalQty: 0,
            totalValue: 0,
            expiringCount: 0,
            criticalCount: 0
        }
    });

    // Filters
    const [filters, setFilters] = useState({
        query: '',
        category: '',
        status: 'all' as any,
        page: 1,
        limit: 50
    });

    // Bulk Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, { cost?: number, mrp?: number }>>({});

    const loadData = async () => {
        setLoading(true);
        try {
            const [report, cats] = await Promise.all([
                getStockReport(filters),
                getCategories()
            ]);

            if (report.success) {
                setData(report.data || []);
                setMeta(report.meta);
            }
            if (cats) setCategories(cats);
        } catch (err) {
            toast.error("Failed to load stock data");
        } finally {
            setLoading(false);
        }
    };

    const handleHeal = async () => {
        setHealing(true);
        const res = await repairStockQuantities();
        if (res.success) {
            toast.success("Inventory Quantities Synchronized Successfully!");
            loadData();
        } else {
            toast.error(res.error || "Repair failed");
        }
        setHealing(false);
    };

    const handlePriceHeal = async () => {
        setPriceHealing(true);
        const res = await repairMissingPrices();
        if (res.success) {
            toast.success(res.message);
            loadData();
        } else {
            toast.error(res.error || "Price repair failed");
        }
        setPriceHealing(false);
    };

    useEffect(() => {
        loadData();
    }, [filters.page, filters.category, filters.status]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters({ ...filters, page: 1 });
        loadData();
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(d => d.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBatchUpdate = (batchId: string, field: 'cost' | 'mrp', value: string) => {
        setPendingUpdates(prev => ({
            ...prev,
            [batchId]: {
                ...prev[batchId],
                [field]: parseFloat(value)
            }
        }));
    };

    const saveChanges = async () => {
        const updateArray = Object.entries(pendingUpdates).map(([batchId, vals]) => ({
            batchId,
            cost: vals.cost,
            mrp: vals.mrp
        }));

        if (updateArray.length === 0) return;

        setLoading(true);
        const res = await bulkUpdateBatchPricing(updateArray as any);
        if (res.success) {
            toast.success(`Successfully updated ${updateArray.length} items`);
            setPendingUpdates({});
            setIsEditMode(false);
            loadData();
        } else {
            toast.error(res.error || "Update failed");
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await exportStockReportToExcel();
            if (res.success && res.base64) {
                const blob = new Blob([Buffer.from(res.base64, 'base64')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.filename || `Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Excel report generated successfully");
            } else {
                toast.error("Failed to generate export");
            }
        } catch (err) {
            console.error("Export failure:", err);
            toast.error("An error occurred during export");
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 bg-slate-50/50 min-h-screen font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                            Stock Intelligence
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-bold">PRO v3.1</Badge>
                        </h1>
                        <p className="text-sm font-medium text-slate-500">Live Godown Valuation & Batch Control</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" className="bg-white border-slate-200" onClick={() => loadData()}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sync Live
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleHeal}
                        disabled={healing}
                        className="text-amber-600 hover:bg-amber-50 font-black text-[10px] uppercase tracking-widest border border-amber-100 h-9"
                    >
                        {healing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <AlertTriangle className="h-3 w-3 mr-2" />}
                        Sync Quantities
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handlePriceHeal}
                        disabled={priceHealing}
                        className="text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase tracking-widest border border-indigo-100 h-9"
                    >
                        {priceHealing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <DollarSign className="h-3 w-3 mr-2" />}
                        Repair Prices
                    </Button>
                    <Button
                        onClick={handleExport}
                        className="bg-slate-900 border-slate-800 text-white shadow-lg shadow-slate-900/10"
                    >
                        {loading && !isEditMode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start relative z-10">
                            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md">
                                <DollarSign className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Godown Value</p>
                                <h3 className="text-3xl font-black mt-1">₹{meta.globalSummary.totalValue.toLocaleString('en-IN')}</h3>
                                <p className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center justify-end gap-1">
                                    <TrendingUp className="h-3 w-3" /> Live Inventory Assets
                                </p>
                            </div>
                        </div>
                        {/* Decorative Chart Background */}
                        <div className="absolute -bottom-4 -left-4 opacity-10 group-hover:scale-110 transition-transform">
                            <BarChart3 className="h-32 w-32" />
                        </div>
                    </CardContent>
                </Card>

                {[
                    { label: 'Total Units Stocked', value: meta.globalSummary.totalQty.toLocaleString(), sub: 'In Physical Godown', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Expiring Soon', value: `${meta.globalSummary.expiringCount} Items`, sub: 'Next 3 Months', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Critical / Out', value: `${meta.globalSummary.criticalCount} Nodes`, sub: 'Below 10 Qty', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all bg-white">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                                    <h3 className="text-2xl font-black text-slate-900 mt-0.5">{loading ? '...' : stat.value}</h3>
                                    <p className="text-[10px] font-bold text-slate-400">{stat.sub}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters Dashboard */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <form onSubmit={handleSearch} className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Find Batch, SKU or Product Name..."
                            className="h-11 pl-10 bg-slate-50 border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-600 transition-all"
                            value={filters.query}
                            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                        />
                    </form>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                            value={filters.category}
                            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <select
                            className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                        >
                            <option value="all">Stock Status: All</option>
                            <option value="in">In Stock Only (&gt;0)</option>
                            <option value="low">Low Stock (&lt;10)</option>
                            <option value="out">Out of Stock (Zero)</option>
                            <option value="negative">Negative Stock</option>
                            <option value="expiry">Expiring (3 Months)</option>
                        </select>

                        <Button
                            variant={isEditMode ? "secondary" : "outline"}
                            className={`h-11 rounded-xl px-4 font-bold border-2 ${isEditMode ? 'border-amber-200 text-amber-700' : 'border-slate-100'}`}
                            onClick={() => setIsEditMode(!isEditMode)}
                        >
                            <Edit3 className="h-4 w-4 mr-2" />
                            {isEditMode ? "Exit Bulk Mode" : "Bulk Value Edit"}
                        </Button>
                    </div>
                </div>

                {isEditMode && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-amber-900 uppercase">Valuation Edit Mode Active</p>
                                <p className="text-[10px] font-bold text-amber-600">Changes are staged. Click "Sync Updates" to commit to database.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setPendingUpdates({}); setIsEditMode(false); }}>Cancel</Button>
                            <Button size="sm" onClick={saveChanges} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-lg shadow-amber-600/20">
                                <Save className="h-3.5 w-3.5 mr-2" /> Sync Updates ({Object.keys(pendingUpdates).length})
                            </Button>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Main Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-none">
                            <TableHead className="w-12">
                                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-600 transition-colors">
                                    {selectedIds.length === data.length ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                                </button>
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Node / SKU</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Product Particulars</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Batch Info</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">In-Stock</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Cost Price</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">MRP / Sale</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Valuation</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                            <p className="text-sm font-bold text-slate-400 italic">Calculating Godown Inventory...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                <Box className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900">No Inventory Nodes Found</p>
                                                <p className="text-xs font-medium text-slate-400">Try adjusting your filters or search query.</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : data.map((item, i) => (
                                <motion.tr
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    key={item.id}
                                    className={`group hover:bg-slate-50/50 transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/30' : ''}`}
                                >
                                    <TableCell>
                                        <button onClick={() => toggleSelect(item.id)} className={`transition-colors ${selectedIds.includes(item.id) ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                            {selectedIds.includes(item.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black font-mono text-slate-900">{item.sku}</p>
                                            <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold bg-slate-50 text-slate-500 border-slate-200">{item.uom}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[200px]">
                                            <p className="font-black text-slate-900 text-sm truncate">{item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.category}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                                                <Tag className="h-2.5 w-2.5 text-slate-400" /> {item.batchNo}
                                            </p>
                                            <p className={`text-[10px] font-bold flex items-center gap-1 ${new Date(item.expiryDate) < new Date() ? 'text-rose-600' : 'text-slate-400'}`}>
                                                <Clock className="h-2.5 w-2.5" />
                                                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'No Expiry'}
                                            </p>
                                        </div>
                                    </TableCell>
                                     <TableCell className="text-right">
                                         <div className="space-y-1">
                                             <p className={`text-sm font-black ${item.qty < 5 ? 'text-rose-600' : 'text-slate-900'}`}>{item.friendlyQty || item.qty.toLocaleString()}</p>
                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">({item.qty.toLocaleString()} {item.uom})</p>
                                         </div>
                                     </TableCell>
                                    <TableCell className="text-right">
                                        {isEditMode ? (
                                            <div className="flex items-center justify-end">
                                                <span className="text-[10px] text-slate-400 mr-1">₹</span>
                                                <input
                                                    type="number"
                                                    defaultValue={item.costPrice}
                                                    onChange={(e) => handleBatchUpdate(item.id, 'cost', e.target.value)}
                                                    className="w-16 h-8 bg-white border border-amber-200 rounded text-right text-xs font-black text-slate-900 px-1 outline-none focus:ring-2 focus:ring-amber-500"
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-600">₹{item.costPrice.toLocaleString()}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {isEditMode ? (
                                            <div className="flex items-center justify-end">
                                                <span className="text-[10px] text-slate-400 mr-1">₹</span>
                                                <input
                                                    type="number"
                                                    defaultValue={item.mrp}
                                                    onChange={(e) => handleBatchUpdate(item.id, 'mrp', e.target.value)}
                                                    className="w-16 h-8 bg-white border border-amber-200 rounded text-right text-xs font-black text-indigo-600 px-1 outline-none focus:ring-2 focus:ring-amber-500"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-black text-indigo-600">₹{item.mrp.toLocaleString()}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Sale: ₹{item.salePrice.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <p className="text-sm font-black text-emerald-600">₹{item.totalValue.toLocaleString()}</p>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                            variant="outline"
                                            className={`text-[9px] font-black uppercase tracking-widest ${item.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (item.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')}`}
                                        >
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </TableBody>
                </Table>

                {/* Performance Pagination */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Displaying {data.length} of {meta.total} nodes
                    </p>
                    <div className="flex items-center gap-3">
                        <Button
                            disabled={filters.page === 1}
                            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                            variant="outline" size="sm" className="h-8 rounded-lg bg-white"
                        >
                            <ArrowLeft className="h-3 w-3 mr-1" /> Prev
                        </Button>
                        <span className="text-xs font-black text-slate-900 px-2">{filters.page} / {meta.totalPages}</span>
                        <Button
                            disabled={filters.page >= meta.totalPages}
                            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                            variant="outline" size="sm" className="h-8 rounded-lg bg-white"
                        >
                            Next <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const Tag = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><path d="M7 7h.01" /></svg>
);
