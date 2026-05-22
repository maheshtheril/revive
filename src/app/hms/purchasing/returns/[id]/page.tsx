'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPurchaseReturn, deletePurchaseReturn } from '@/app/actions/returns';
import { ArrowLeft, Loader2, Undo2, Trash2, Printer, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PurchaseReturnDetailsPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { toast } = useToast();
    const [returnIdx, setReturnIdx] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const res = await getPurchaseReturn(params.id);
                if (res.success && res.data) {
                    setReturnIdx(res.data);
                } else {
                    toast({ title: "Error", description: res.error || "Return not found", variant: "destructive" });
                    router.push('/hms/purchasing/returns');
                }
            } catch (error) {
                console.error("Failed to load return", error);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [params.id, router, toast]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await deletePurchaseReturn(params.id);
            if (res.success) {
                toast({ title: "Deleted", description: "Return deleted successfully." });
                router.push('/hms/purchasing/returns');
            } else {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Delete failed", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-background text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
        );
    }

    if (!returnIdx) return null;

    const isDraft = returnIdx.status === 'draft';

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/hms/purchasing/returns">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                                Debit Note
                                <span className="font-mono text-red-600">#{returnIdx.return_number}</span>
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                {new Date(returnIdx.return_date).toLocaleDateString()} • {returnIdx.hms_supplier?.name || 'Unknown Supplier'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isDraft && (
                            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100">
                                Posted
                            </div>
                        )}
                        {isDraft && (
                            <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-gray-200">
                                Draft
                            </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => window.open(`/api/return-printer/${returnIdx.id}`, '_blank')}>
                            <Printer className="h-4 w-4 mr-2" /> View PDF
                        </Button>
                        {isDraft && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Draft Return?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this return and INCREASE stock back to original levels. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-border bg-muted/20">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Items Returned</h3>
                    </div>
                    <div className="divide-y divide-border">
                        {returnIdx.lines.map((line: any) => (
                            <div key={line.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                                <div className="col-span-8">
                                    <p className="font-bold text-sm">
                                        {line.hms_product?.name || line.hms_purchase_receipt_line?.description || 'Unknown Item'}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono mt-1">
                                        {line.product_id ? line.hms_product?.sku : 'Ad-hoc Item'}
                                    </p>
                                </div>
                                <div className="col-span-2 text-right">
                                    <p className="text-sm font-bold">{Number(line.qty)}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Qty</p>
                                </div>
                                <div className="col-span-2 text-right">
                                    <p className="text-sm font-bold text-red-600">₹{Number(line.line_total).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t border-border bg-red-50/10 flex justify-between items-center">
                        <div className="text-sm text-muted-foreground max-w-sm">
                            <span className="font-bold">Reason:</span> {returnIdx.reason || 'No reason provided'}
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Debit</p>
                            <p className="text-3xl font-black text-red-600">₹{Number(returnIdx.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>

                {!isDraft && (
                    <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">Cannot Edit Posted Return</p>
                            <p>This debit note has been posted to accounting and cannot be modified. If there is an error, this document serves as a permanent record. Reversal functionality is coming soon.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
