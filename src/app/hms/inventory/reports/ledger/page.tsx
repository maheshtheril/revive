"use client";

import { useEffect, useState, useMemo } from "react";
import { getStockLedgerReport } from "@/app/actions/ledger";
import { getProductsPremium } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ArrowRight, RefreshCw, FileText, Calendar, Filter, Database, Tag, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function StockLedgerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);
    const [productId, setProductId] = useState<string>("ALL");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getStockLedgerReport({
                productId: productId === 'ALL' ? undefined : productId,
                startDate,
                endDate
            });
            if (res.success && res.data) {
                setEntries(res.data);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [productId, startDate, endDate]);

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen font-sans">
            {/* Tally Style Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-border/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-10 w-10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="font-black text-2xl tracking-[0.02em] uppercase text-slate-900 dark:text-white leading-none">
                                STOCK <span className="text-indigo-500">REGISTER</span>
                            </h1>
                            <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">TALLY ERP V.LEGER</Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-60">Transactional Audit & History</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-[300px] relative group">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10" />
                        <SearchableSelect
                            value={productId}
                            onChange={(id) => setProductId(id || 'ALL')}
                            onSearch={async (q) => {
                                const res = await getProductsPremium(q) as any;
                                return res?.data?.map((p: any) => ({ id: p.id, label: p.name, subLabel: p.sku })) || [];
                            }}
                            placeholder="Select Product (Medicine)..."
                            className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-none h-11 text-sm font-bold pl-10 rounded-xl"
                            variant="ghost"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-transparent hover:border-indigo-500/20 transition-all">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="h-9 px-9 bg-transparent border-none text-[11px] font-black w-32 focus:ring-0" 
                            />
                        </div>
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className="h-9 px-9 bg-transparent border-none text-[11px] font-black w-32 focus:ring-0" 
                            />
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl h-11 w-11 shadow-sm border-border hover:bg-slate-100 transition-all active:scale-95">
                        <Printer className="h-5 w-5 text-slate-400" />
                    </Button>
                </div>
            </div>

            {/* List Section */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-border/40 overflow-hidden flex flex-col relative min-h-[600px]">
                <div className="absolute inset-0 bg-slate-900/[0.01] pointer-events-none"></div>
                
                <div className="overflow-auto custom-scrollbar flex-1">
                    <Table className="relative">
                        <TableHeader className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl border-b border-border">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-40 text-[10px] font-black uppercase text-indigo-500 tracking-widest pl-8">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Type / Particulars</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reference</TableHead>
                                <TableHead className="w-32 text-center text-[10px] font-black uppercase text-emerald-500 tracking-widest">IN (Qty)</TableHead>
                                <TableHead className="w-32 text-center text-[10px] font-black uppercase text-rose-500 tracking-widest">OUT (Qty)</TableHead>
                                <TableHead className="w-40 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest pr-8">Unit Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[400px] text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Syncing Register...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[400px] text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-50">
                                            <Database className="h-12 w-12 text-slate-200" />
                                            <h3 className="text-lg font-black text-slate-400">NO TRANSACTIONS RECORDED</h3>
                                            <p className="text-[10px] font-bold text-slate-400 max-w-[300px] mx-auto uppercase tracking-tighter leading-relaxed">The register is empty for the current filter. Ensure you have clicked 'Reset Slate' if you wiped the data.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((e, i) => (
                                    <TableRow key={e.id} className="group border-b border-slate-50 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors cursor-pointer">
                                        <TableCell className="pl-8">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-900 dark:text-white">{new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[9px] font-mono text-slate-400 font-bold">{new Date(e.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-8 w-8 rounded-lg flex items-center justify-center border-2",
                                                    e.movement_type === 'in' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-rose-500/5 border-rose-500/20 text-rose-500"
                                                )}>
                                                    {e.movement_type === 'in' ? <ArrowRight className="h-4 w-4 rotate-45" /> : <ArrowLeft className="h-4 w-4 -rotate-45" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{e.hms_product?.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">{e.movement_type === 'in' ? 'PURCHASE / RCPT' : 'SALES / ISSUE'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3 w-3 text-slate-300" />
                                                <span className="text-[11px] font-bold text-slate-500 font-mono tracking-tighter truncate max-w-[150px]">{e.reference || `REF-${e.id.split('-')[0].toUpperCase()}`}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {e.movement_type === 'in' ? (
                                                <span className="text-[14px] font-black text-emerald-500">{e.qty} {e.hms_product?.uom}</span>
                                            ) : <span className="opacity-10">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {e.movement_type === 'out' ? (
                                                <span className="text-[14px] font-black text-rose-500">{Math.abs(e.qty)} {e.hms_product?.uom}</span>
                                            ) : <span className="opacity-10">-</span>}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <span className="text-[14px] font-bold text-slate-900 dark:text-white">₹{Number(e.unit_cost || 0).toFixed(2)}</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Section - Totals */}
                {!loading && entries.length > 0 && (
                    <div className="px-8 py-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-10 shrink-0">
                        <div className="flex items-center gap-12">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Inbound</span>
                                <span className="text-lg font-black text-emerald-400">
                                    {entries.filter(e => e.movement_type === 'in').length} Entries
                                </span>
                            </div>
                            <div className="h-10 w-px bg-slate-800"></div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Outbound</span>
                                <span className="text-lg font-black text-rose-500">
                                    {entries.filter(e => e.movement_type === 'out').length} Entries
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 pr-6 pl-2">
                             <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Database className="h-5 w-5 text-white" />
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Ledger Summary</span>
                                <span className="text-[11px] font-bold text-white uppercase tracking-tighter">Verified Audit Trail</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
