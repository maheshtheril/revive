'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSalesReturns } from '@/app/actions/returns';
import { getInvoiceByNumber } from '@/app/actions/billing';
import { ArrowLeft, Loader2, RotateCcw, Calendar, Search, ArrowRight, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

type SalesReturn = {
    id: string;
    returnNumber: string;
    date: Date;
    patientName: string;
    invoiceNumber: string | null;
    itemCount: number;
    totalAmount: number;
    status: string;
    reason: string | null;
    refundMethod: string;
};

export default function SalesReturnsPage() {
    const router = useRouter();
    const [returns, setReturns] = useState<SalesReturn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [billSearch, setBillSearch] = useState('');
    const [isSearchingBill, setIsSearchingBill] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const res = await getSalesReturns();
                if (res.success && res.data) {
                    setReturns(res.data);
                }
            } catch (error) {
                console.error("Failed to load returns", error);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    const { toast } = useToast();
    const handleBillSearch = async () => {
        if (!billSearch) return;
        setIsSearchingBill(true);
        try {
            const res = await getInvoiceByNumber(billSearch);
            if (res.success && res.data) {
                router.push(`/hms/billing/${res.data}?action=return`);
            } else {
                toast({ title: "Not Found", description: "Could not find a bill with that number.", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Search failed", variant: "destructive" });
        } finally {
            setIsSearchingBill(false);
        }
    };

    const filteredReturns = returns.filter(r =>
        r.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.patientName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-8">
            <div className="max-w-[1600px] mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2 text-foreground flex items-center gap-3">
                        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><RotateCcw className="h-6 w-6" /></span>
                        Sales Returns
                    </h1>
                    <p className="text-muted-foreground text-sm pl-12 font-medium">Credit Notes for patient refunds.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search Credit Notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted/50 border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 w-64 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                            <Search className="h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Return by Bill #..."
                                className="bg-transparent border-none outline-none text-xs font-medium w-36 placeholder:text-slate-500"
                                value={billSearch}
                                onChange={e => setBillSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleBillSearch()}
                            />
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={handleBillSearch}
                                disabled={isSearchingBill}
                            >
                                {isSearchingBill ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                            </Button>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/hms/billing">
                                <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-white hover:shadow-md transition-all">
                                    <FileText className="h-4 w-4 mr-2 text-slate-500" /> Browse Invoices
                                </Button>
                            </Link>
                            <Link href="/hms/billing/returns/new">
                                <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10 transition-all active:scale-95">
                                    <Plus className="h-4 w-4 mr-2" /> New Sales Return
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    </div>
                ) : filteredReturns.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
                        <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <RotateCcw className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">No Returns Found</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                            Sales returns (Credit Notes) are created from Invoices when a patient returns items or requests a refund.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest border-b border-border bg-muted/30 rounded-t-xl">
                            <div className="col-span-2">CN Number</div>
                            <div className="col-span-1">Date</div>
                            <div className="col-span-2">Patient</div>
                            <div className="col-span-2">Items</div>
                            <div className="col-span-2 text-right">Refund Amount</div>
                            <div className="col-span-1">Source Bill</div>
                            <div className="col-span-1 text-center">Method</div>
                            <div className="col-span-1 text-right">Status</div>
                        </div>

                        {filteredReturns.map((ret) => (
                            <div
                                key={ret.id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 bg-card hover:bg-emerald-50/50 transition-all border-b border-border items-center group"
                            >
                                <div className="col-span-2 font-mono text-sm text-emerald-600 font-bold">
                                    <Link href={`/hms/billing/returns/${ret.id}`} className="hover:underline underline-offset-4">
                                        {ret.returnNumber}
                                    </Link>
                                </div>
                                <div className="col-span-1 flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                    {new Date(ret.date).toLocaleDateString()}
                                </div>
                                <div className="col-span-2 text-sm text-foreground font-bold truncate">
                                    {ret.patientName}
                                </div>
                                <div className="col-span-2 text-[10px] text-muted-foreground font-medium">
                                    {ret.itemCount} items
                                </div>
                                <div className="col-span-2 text-right text-sm font-black text-foreground font-mono">
                                    ₹{ret.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="col-span-1 text-[10px] font-mono flex items-center gap-2">
                                    {ret.invoiceNumber || 'AD-HOC'}
                                </div>
                                <div className="col-span-1 flex flex-col items-center justify-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter ${
                                        (ret.refundMethod?.toLowerCase() === 'cash')
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' 
                                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}>
                                        {(ret.refundMethod?.toLowerCase() === 'cash') ? 'CASH REFUND' : 'CREDIT NOTE'}
                                    </span>
                                    <span className="text-[6px] text-slate-300 font-mono mt-1 uppercase">{ret.refundMethod}</span>
                                </div>
                                <div className="col-span-1 text-right">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${ret.status === 'posted'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                                        }`}>
                                        {ret.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
