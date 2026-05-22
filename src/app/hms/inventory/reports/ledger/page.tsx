"use client";

import { useEffect, useState, useMemo } from "react";
import { getStockLedgerReport, updateStockLedgerEntry, deleteStockLedgerEntry } from "@/app/actions/ledger";
import { getProductsPremium } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, ArrowLeft, ArrowRight, RefreshCw, FileText, 
    Calendar, Filter, Database, Tag, Printer, Settings2, Trash2, Edit3, X, Check, AlertCircle 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

export default function StockLedgerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);
    const [productId, setProductId] = useState<string>("ALL");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Admin Edit State
    const [editingEntry, setEditingEntry] = useState<any>(null);
    const [newQty, setNewQty] = useState<string>("");
    const [editReason, setEditReason] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleUpdate = async () => {
        if (!editingEntry || !newQty || !editReason) {
            toast.error("Please provide quantity and reason");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await updateStockLedgerEntry(editingEntry.id, parseFloat(newQty), editReason);
            if (res.success) {
                toast.success("Register Updated Successfully!");
                setEditingEntry(null);
                loadData();
            } else {
                toast.error(res.error || "Update failed");
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to PERMANENTLY delete this entry and REVERT its stock impact?")) return;
        
        try {
            const res = await deleteStockLedgerEntry(id);
            if (res.success) {
                toast.success("Entry Deleted & Stock Reverted");
                loadData();
            } else {
                toast.error(res.error);
            }
        } catch (err: any) {
            toast.error(err.message);
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
                                MOVEMENT <span className="text-indigo-500">REGISTER</span>
                            </h1>
                            <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap">MANAGEMENT MODE</Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-60">ADMINISTRATIVE AUDIT & DATA CORRECTION</p>
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
                            placeholder="Find Product Movement..."
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
                        <RefreshCw className={cn("h-5 w-5 text-slate-400", loading && "animate-spin")} />
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
                                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Type / Product</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reference / Lot</TableHead>
                                <TableHead className="w-32 text-center text-[10px] font-black uppercase text-emerald-500 tracking-widest">IN (Qty)</TableHead>
                                <TableHead className="w-32 text-center text-[10px] font-black uppercase text-rose-500 tracking-widest">OUT (Qty)</TableHead>
                                <TableHead className="w-40 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[400px] text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Scanning Registry...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[400px] text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-50">
                                            <Database className="h-12 w-12 text-slate-200" />
                                            <h3 className="text-lg font-black text-slate-400">NO HISTORY FOUND</h3>
                                            <p className="text-[10px] font-bold text-slate-400 max-w-[300px] mx-auto uppercase tracking-tighter leading-relaxed italic">No movement recorded in this sector yet.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((e, i) => {
                                    const isInbound = ['in', 'purchase', 'adjustment_in', 'opening_stock', 'return_in'].includes(e.movement_type);
                                    
                                    return (
                                        <TableRow key={e.id} className="group border-b border-slate-50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all cursor-default">
                                            <TableCell className="pl-8">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[9px] font-mono text-slate-400 font-bold">{new Date(e.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-lg flex items-center justify-center border-2",
                                                        isInbound ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-rose-500/5 border-rose-500/20 text-rose-500"
                                                    )}>
                                                        {isInbound ? <ArrowRight className="h-4 w-4 rotate-45" /> : <ArrowLeft className="h-4 w-4 -rotate-45" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{e.hms_product?.name}</span>
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest italic",
                                                            isInbound ? "text-emerald-500" : "text-rose-500"
                                                        )}>{e.movement_type.replace('_', ' ')}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-3 w-3 text-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-500 font-mono tracking-tighter truncate max-w-[200px]">{e.reference || 'SYSTEM GEN'}</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-slate-400 pl-5">Lot ID: {e.batch_id?.split('-')[0] || 'UNBATCHED'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isInbound ? (
                                                    <span className="text-[14px] font-black text-emerald-500">{Number(e.qty)} {e.hms_product?.uom}</span>
                                                ) : <span className="opacity-10">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {!isInbound ? (
                                                    <span className="text-[14px] font-black text-rose-500">{Math.abs(Number(e.qty))} {e.hms_product?.uom}</span>
                                                ) : <span className="opacity-10">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"
                                                        onClick={() => {
                                                            setEditingEntry(e);
                                                            setNewQty(Math.abs(Number(e.qty)).toString());
                                                            setEditReason("");
                                                        }}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                                                        onClick={() => handleDelete(e.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Status Bar */}
                <div className="px-8 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active nodes</span>
                            <span className="text-xs font-black text-white">{entries.length} History Items</span>
                        </div>
                        <div className="h-6 w-px bg-slate-800"></div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-slate-300 uppercase italic">Live Synchronized</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MANAGEMENT MODAL */}
            <Dialog open={!!editingEntry} onOpenChange={() => !isSubmitting && setEditingEntry(null)}>
                <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                    <div className="bg-slate-900 p-8 text-white">
                        <DialogHeader>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <Settings2 className="h-6 w-6 text-white" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Correct Movement</DialogTitle>
                                    <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Surgical Data Overwrite</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        
                        <div className="space-y-4 mt-6">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Product Identity</p>
                                <p className="text-lg font-black tracking-tight">{editingEntry?.hms_product?.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{editingEntry?.movement_type.replace('_', ' ')} • Current: {editingEntry?.qty} {editingEntry?.hms_product?.uom}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">True Quantity Count</label>
                                    <Input 
                                        type="number" 
                                        value={newQty}
                                        onChange={(e) => setNewQty(e.target.value)}
                                        className="h-14 bg-white/10 border-none text-xl font-black rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-white placeholder:text-slate-700"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justification / Reason</label>
                                    <Input 
                                        value={editReason}
                                        onChange={(e) => setEditReason(e.target.value)}
                                        className="h-12 bg-white/10 border-none text-xs font-bold rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-white placeholder:text-slate-700"
                                        placeholder="Audit typo, Duplicate entry, etc..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl text-amber-600 dark:text-amber-500">
                             <AlertCircle className="h-5 w-5 shrink-0" />
                             <p className="text-[10px] font-black uppercase leading-tight italic">Warning: Stock levels for the associated batch and location will be automatically recalculated based on this change.</p>
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                             <Button 
                                variant="outline" 
                                onClick={() => setEditingEntry(null)}
                                className="flex-1 h-12 rounded-2xl border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                             >
                                Discard
                             </Button>
                             <Button 
                                onClick={handleUpdate}
                                disabled={isSubmitting}
                                className="flex-[2] h-12 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-900/20 disabled:opacity-50"
                             >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                Sync Register
                             </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
