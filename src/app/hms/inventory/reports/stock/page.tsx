"use client";

import { useEffect, useState, useCallback } from "react";
import { getStockReport, getCategories, getManufacturers } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, Search, ArrowLeft, ArrowRight, RefreshCw, 
    FileDown, Filter, AlertTriangle, Package, CheckCircle2,
    Database, LayoutGrid, Building2, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Simple local debounce
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function StockReportPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounceValue(search, 500);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryId, setCategoryId] = useState("ALL");
    const [manufacturerId, setManufacturerId] = useState("ALL");
    
    const [categories, setCategories] = useState<any[]>([]);
    const [manufacturers, setManufacturers] = useState<any[]>([]);
    
    const [meta, setMeta] = useState({
        total: 0,
        page: 1,
        totalPages: 1,
        summary: { totalStockOnHand: 0, totalValue: 0 }
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getStockReport({ 
                query: debouncedSearch, 
                page, 
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                categoryId: categoryId !== 'ALL' ? categoryId : undefined,
                manufacturerId: manufacturerId !== 'ALL' ? manufacturerId : undefined
            } as any);
            
            if (result.success && result.data) {
                setData(result.data);
                setMeta(result.meta as any);
            }
        } catch (error) {
            console.error("Failed to load stock report:", error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, page, statusFilter, categoryId, manufacturerId]);

    const loadMeta = async () => {
        const [cats, mans] = await Promise.all([
            getCategories(),
            getManufacturers()
        ]);
        setCategories(cats);
        setManufacturers(mans);
    };

    useEffect(() => {
        loadMeta();
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleExport = () => {
        // Simple CSV export
        const headers = ["SKU", "Product Name", "Category", "Manufacturer", "UOM", "Stock On Hand", "Value", "Status"];
        const rows = data.map(item => [
            `"${item.sku}"`,
            `"${item.name}"`,
            `"${item.category}"`,
            `"${item.manufacturer}"`,
            `"${item.uom}"`,
            item.stockOnHand,
            item.stockValue,
            `"${item.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `stock_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white dark:bg-slate-900 shadow-sm border">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-2xl md:text-3xl tracking-tight text-slate-900 dark:text-slate-100 italic">
                            WORLD <span className="text-blue-600 dark:text-blue-400">STOCK</span> REPORT
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Enterprise Inventory Intelligence v3.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            if(confirm("This will repair all batch costs by scanning the ledger history. Proceed?")) {
                                setLoading(true);
                                const { repairBatchCosts } = await import("@/app/actions/stock-healer");
                                const res = await repairBatchCosts() as any;
                                if(res?.success) {
                                    alert(res.message || "Valuations Repaired Successfully");
                                    loadData();
                                } else {
                                    alert("Error: " + (res?.error || "Unknown error"));
                                    setLoading(false);
                                }
                            }
                        }}
                        className="bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 text-xs gap-1 shadow-sm"
                    >
                        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                        RE-SYNC VALUATIONS
                    </Button>
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            if(confirm("This will re-calculate all stock levels from the transaction ledger. Proceed?")) {
                                setLoading(true);
                                const { recalculateStockLevels } = await import("@/app/actions/inventory");
                                const res = await recalculateStockLevels() as any;
                                if(res?.success) {
                                    alert("Inventory Recalculated Successfully");
                                    loadData();
                                } else {
                                    alert("Error: " + (res?.error || "Unknown error"));
                                    setLoading(false);
                                }
                            }
                        }}
                        className="bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-xs gap-1 shadow-sm"
                    >
                        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                        RE-SYNC LEDGER
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={handleExport} 
                        disabled={loading || data.length === 0}
                        className="bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md"
                    >
                        <FileDown className="mr-2 h-4 w-4 text-green-600" />
                        Export Data
                    </Button>
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                             const wipeType = confirm("Full Nuclear Wipe (Delete 367 Medicines + Purchase History) or Just Purchase History?\n\nOK = FULL WIPE (EVERYTHING TO 0)\nCancel = JUST STOCK HISTORY (KEEP CATALOG)") 
                                ? true : false;

                             const confirm1 = confirm(`DANGER: You selected ${wipeType ? 'FULL NUCLEAR WIPE' : 'STOCK ONLY WIPE'}. This will permanently reset metrics to Zero. Proceed?`);
                             if(confirm1) {
                                     setLoading(true);
                                     const { totalNuclearWipe } = await import("@/app/actions/slate-reset");
                                     // For verification during the wipe
                                     const res = await totalNuclearWipe(wipeType) as any;
                                     if(res?.success) {
                                         alert(`SUCCESS: ${res.message}\nWiped IDs: ${res.debugIds || "N/A"}`);
                                         loadData();
                                     } else {
                                         alert(`FAILED: ${res?.error || "Unknown Error"}`);
                                     }
                                     setLoading(false);
                             }
                        }}
                        className="bg-red-600 text-white border-red-700 hover:bg-red-700 text-[10px] font-black gap-1 shadow-lg animate-pulse hover:animate-none"
                    >
                        <Trash2 className="h-3 w-3" />
                        WIPE ALL DATA (RESET)
                    </Button>
                    <Button 
                        variant="default" 
                        size="icon" 
                        onClick={() => loadData()}
                        className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-transform active:scale-95"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                {/* 1. PHYSICAL STOCK COUNT */}
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 overflow-hidden relative group hover:scale-[1.02] transition-all">
                    <div className="absolute right-0 top-0 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform">
                        <Package className="h-24 w-24 text-emerald-600" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Stock Units on Hand (Pcs)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">
                            {loading ? "---" : meta.summary?.totalStockOnHand?.toLocaleString('en-IN')}
                        </div>
                        <p className="text-[9px] mt-1 text-slate-400 font-bold uppercase tracking-widest italic">Total Units across all batches</p>
                    </CardContent>
                </Card>

                {/* 2. PRODUCT CATALOG (MASTER DATA) */}
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/50 overflow-hidden relative group hover:scale-[1.02] transition-all">
                   <div className="absolute right-0 top-0 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform">
                        <Database className="h-24 w-24 text-slate-600" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Master Product Registry</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-500 dark:text-slate-400 tracking-tighter">
                            {loading ? "---" : (meta.total || 0).toLocaleString()}
                        </div>
                        <p className="text-[9px] mt-1 text-slate-400 font-bold uppercase tracking-widest italic leading-tight">Count of Medicine Masters Setup</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Action Bar */}
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex flex-1 flex-wrap items-center gap-3">
                            {/* Detailed Search */}
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search Product Serial/SKU/Name..."
                                    className="pl-10 h-10 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:ring-blue-500 transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Status Pills */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border dark:border-slate-800">
                                {['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].map((st) => (
                                    <Button 
                                        key={st}
                                        variant={statusFilter === st ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        className={cn(
                                            "h-8 text-[11px] px-3 font-semibold uppercase tracking-tight transition-all",
                                            statusFilter === st ? "shadow-sm bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400" : "text-slate-500"
                                        )}
                                        onClick={() => { setStatusFilter(st); setPage(1); }}
                                    >
                                        {st.replace('_', ' ')}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-slate-400" />
                                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
                                    <SelectTrigger className="w-[160px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Categories</SelectItem>
                                        {categories.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-400" />
                                <Select value={manufacturerId} onValueChange={(v) => { setManufacturerId(v); setPage(1); }}>
                                    <SelectTrigger className="w-[160px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium">
                                        <SelectValue placeholder="Manufacturer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Manufacturers</SelectItem>
                                        {manufacturers.map((m: any) => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                                    <TableHead className="py-4 pl-6 text-[11px] font-bold uppercase text-slate-400">SKU Code</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold uppercase text-slate-400 w-[400px]">Product Description</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold uppercase text-slate-400">Category</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold uppercase text-slate-400 text-center">UOM</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold uppercase text-slate-400 text-right">Qty On Hand</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase text-slate-400 text-center pr-6">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <p className="text-xs font-medium text-slate-500 animate-pulse">Scanning Inventory Repositories...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-slate-500 font-medium italic">
                                            No products matching critical criteria found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800">
                                            <TableCell className="pl-6 py-4">
                                                <code className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    {item.sku}
                                                </code>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{item.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium uppercase">{item.manufacturer}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="outline" className="text-[10px] font-medium border-slate-200 dark:border-slate-800 bg-white dark:bg-transparent text-slate-500">
                                                    {item.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center py-4">
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{item.uom}</span>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    item.stockOnHand <= 0 ? "text-red-500" : (item.stockOnHand < 10 ? "text-amber-500" : "text-slate-700 dark:text-slate-300")
                                                )}>
                                                    {item.stockOnHand.toLocaleString('en-IN')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center py-4 pr-6">
                                                <Badge
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 font-bold border-none uppercase tracking-tighter",
                                                        item.status === 'In Stock' && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
                                                        item.status === 'Low Stock' && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                                                        item.status === 'Out of Stock' && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                                    )}
                                                >
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {meta.totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50 dark:bg-slate-950/20">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-tight">
                                Showing Page {meta.page} OF {meta.totalPages} • Total {meta.total} Records
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-white transition-all shadow-sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                >
                                    <ArrowLeft className="h-4 w-4 text-slate-400" />
                                </Button>
                                {[...Array(Math.min(5, meta.totalPages))].map((_, i) => {
                                    const pNum = i + 1;
                                    return (
                                        <Button
                                            key={i}
                                            variant={page === pNum ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn(
                                                "h-8 w-8 p-0 text-xs font-bold rounded-lg transition-all",
                                                page === pNum ? "bg-blue-600 shadow-blue-200" : "bg-transparent text-slate-400 hover:text-slate-600 p-0"
                                            )}
                                            onClick={() => setPage(pNum)}
                                        >
                                            {pNum}
                                        </Button>
                                    );
                                })}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-white transition-all shadow-sm"
                                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                    disabled={page === meta.totalPages || loading}
                                >
                                    <ArrowRight className="h-4 w-4 text-slate-400" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
