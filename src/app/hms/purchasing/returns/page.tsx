'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPurchaseReturns } from '@/app/actions/returns';
import { ArrowLeft, Loader2, Undo2, Calendar, Box, Search, FileText, Plus } from 'lucide-react';
import Link from 'next/link';

type PurchaseReturn = {
    id: string;
    returnNumber: string;
    date: Date;
    supplierName: string;
    itemCount: number;
    totalAmount: number;
    status: string;
    reason: string | null;
};

export default function PurchaseReturnsPage() {
    const router = useRouter();
    const [returns, setReturns] = useState<PurchaseReturn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const res = await getPurchaseReturns();
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

    const filteredReturns = returns.filter(r =>
        r.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-8">
            <div className="max-w-[1600px] mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2 text-foreground flex items-center gap-3">
                        <span className="p-2 bg-red-50 text-red-600 rounded-lg"><Undo2 className="h-6 w-6" /></span>
                        Purchase Returns
                    </h1>
                    <p className="text-muted-foreground text-sm pl-12 font-medium">Debit Notes sent to vendors.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search Debit Notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted/50 border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 w-64 transition-all"
                        />
                    </div>
                    <Link href="/hms/purchasing/receipts">
                        <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                            Back to Receipts
                        </button>
                    </Link>
                    <Link href="/hms/purchasing/returns/new">
                        <button className="bg-red-600 hover:bg-red-700 text-white font-bold transition-all px-5 py-2.5 rounded-full text-xs uppercase tracking-widest shadow-md shadow-red-500/20 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> New Direct Return
                        </button>
                    </Link>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                    </div>
                ) : filteredReturns.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
                        <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Undo2 className="h-8 w-8 text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">No Returns Found</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                            Purchase returns (Debit Notes) are created directly from Purchase Receipts when you need to send stock back to a vendor.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest border-b border-border bg-muted/30 rounded-t-xl">
                            <div className="col-span-2">DN Number</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-3">Vendor / Supplier</div>
                            <div className="col-span-2">Items</div>
                            <div className="col-span-2 text-right">Debit Amount</div>
                            <div className="col-span-1 text-right">Status</div>
                        </div>

                        {filteredReturns.map((ret) => (
                            <Link
                                key={ret.id}
                                href={`/hms/purchasing/returns/${ret.id}`}
                                className="grid grid-cols-12 gap-4 px-6 py-4 bg-card hover:bg-red-50/50 transition-all border-b border-border items-center group cursor-pointer"
                            >
                                <div className="col-span-2 font-mono text-sm text-red-600 font-bold">
                                    {ret.returnNumber}
                                </div>
                                <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                    <Calendar className="h-3 w-3 text-muted-foreground/70" />
                                    {new Date(ret.date).toLocaleDateString()}
                                </div>
                                <div className="col-span-3 text-sm text-foreground font-bold truncate">
                                    {ret.supplierName}
                                </div>
                                <div className="col-span-2 text-sm text-muted-foreground font-medium">
                                    {ret.itemCount} items returned
                                </div>
                                <div className="col-span-2 text-right text-sm font-black text-foreground font-mono">
                                    ₹{ret.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="col-span-1 text-right">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${ret.status === 'posted'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                                        }`}>
                                        {ret.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
