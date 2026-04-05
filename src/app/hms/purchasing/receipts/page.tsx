'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPurchaseReceipts } from '@/app/actions/receipt';
import { ArrowLeft, Loader2, Plus, FileText, Calendar, Box, Search } from 'lucide-react';
import { ReceiptEntryDialog } from '@/components/hms/purchasing/receipt-entry-dialog';

type Receipt = {
    id: string;
    number: string | null;
    date: Date;
    supplierName: string;
    reference: any;
    itemCount: number;
    totalAmount: number;
    status: string | null;
};

export default function PurchaseReceiptsPage() {
    const router = useRouter();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

    async function load() {
        setIsLoading(true);
        try {
            const res = await getPurchaseReceipts();
            if (res.success && res.data) {
                setReceipts(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    const filteredReceipts = receipts.filter(r =>
        r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reference?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-8">
            {/* Header */}
            <div className="max-w-[1600px] mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight mb-2 text-foreground">Purchase Receipts (GRN)</h1>
                    <p className="text-muted-foreground text-sm">Review stock inward records. (Goods Received Notes)</p>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/hms/purchasing/returns">
                        <button className="bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2">
                            Debit Notes
                        </button>
                    </Link>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search receipts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted/50 border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                        <Plus className="h-4 w-4" /> New Receipt
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1600px] mx-auto">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
                        <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Box className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-1">No receipts found</h3>
                        <p className="text-muted-foreground text-sm mb-6">Create a new purchase receipt to record incoming stock.</p>
                        <button
                            onClick={() => setIsDialogOpen(true)}
                            className="text-indigo-500 hover:text-indigo-600 text-sm font-medium"
                        >
                            + Create First Receipt
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Summary Stats */}
                        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Records</p>
                                <p className="text-2xl font-black text-foreground">{filteredReceipts.length}</p>
                            </div>
                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 shadow-sm">
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Total Purchase Value</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-indigo-500/70">₹</span>
                                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                        {filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
                                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Items</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {filteredReceipts.reduce((sum, r) => sum + (r.itemCount || 0), 0)}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                                <div className="col-span-2">Receipt #</div>
                                <div className="col-span-2">Date</div>
                                <div className="col-span-3">Supplier</div>
                                <div className="col-span-2">Ref Invoice</div>
                                <div className="col-span-1 text-right">Qty</div>
                                <div className="col-span-1 text-right whitespace-nowrap">Bill Amount</div>
                                <div className="col-span-1 text-right">Status</div>
                            </div>

                            {filteredReceipts.map((receipt) => (
                                <div
                                    key={receipt.id}
                                    onClick={() => {
                                        setSelectedReceiptId(receipt.id);
                                        setIsDialogOpen(true);
                                    }}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 bg-card hover:bg-muted/50 transition-all rounded-xl border border-border items-center group cursor-pointer shadow-sm hover:shadow-md"
                                >
                                    <div className="col-span-2 font-mono text-sm text-indigo-500 font-medium group-hover:text-indigo-600 dark:text-indigo-400 dark:group-hover:text-indigo-300">
                                        {receipt.number}
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-3 w-3 text-muted-foreground/70" />
                                        {new Date(receipt.date).toLocaleDateString('en-GB')}
                                    </div>
                                    <div className="col-span-3 text-sm text-foreground font-medium truncate">
                                        {receipt.supplierName}
                                    </div>
                                    <div className="col-span-2 text-sm text-muted-foreground font-mono truncate">
                                        {receipt.reference}
                                    </div>
                                    <div className="col-span-1 text-right text-sm text-muted-foreground font-mono">
                                        {receipt.itemCount}
                                    </div>
                                    <div className="col-span-1 text-right text-sm font-bold text-foreground font-mono">
                                        ₹{receipt.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                                            {receipt.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <ReceiptEntryDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setSelectedReceiptId(null);
                }}
                viewReceiptId={selectedReceiptId}
                onSuccess={() => {
                    setIsDialogOpen(false);
                    setSelectedReceiptId(null);
                    load();
                }}
            />
        </div>
    );
}
