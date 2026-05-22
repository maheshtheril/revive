'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSuppliersList, getProductsPremium } from '@/app/actions/inventory';
import { getPurchaseReceipt } from '@/app/actions/receipt';
import { createPurchaseReturn } from '@/app/actions/returns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type Option } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Undo2, Package, Plus, Trash2, ArrowLeftRight, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ReturnLineItem = {
    id: string; // temp id for UI grid
    receiptLineId?: string;
    productId: string;
    productName: string;
    qty: number;
    unitPrice: number;
    batchNo: string;
    batchId?: string;
    availableStock: number;
    taxRate: number;
    taxAmount: number;
};

export default function NewDirectReturnPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>}>
            <NewDirectReturnContent />
        </Suspense>
    );
}

function NewDirectReturnContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const receiptIdParam = searchParams.get('receiptId');
    const { toast } = useToast();

    const [suppliers, setSuppliers] = useState<Option[]>([]);
    const [supplierId, setSupplierId] = useState<string>('');
    const [supplierName, setSupplierName] = useState<string>('');
    
    const [products, setProducts] = useState<any[]>([]);
    const [productOptions, setProductOptions] = useState<Option[]>([]);
    
    const [items, setItems] = useState<ReturnLineItem[]>([]);
    const [reason, setReason] = useState<string>('Rate difference / Inventory adjustment');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        async function init() {
            try {
                const supRes = await getSuppliersList();
                if (supRes.success && supRes.data) {
                    setSuppliers(supRes.data.map(s => ({ id: s.id, label: s.name })));
                }

                const prodRes = await getProductsPremium();
                if (prodRes.success && prodRes.data) {
                    setProducts(prodRes.data);
                    setProductOptions(prodRes.data.map(p => ({ id: p.id, label: `${p.name} (Stock: ${p.totalStock})` })));
                }

                if (receiptIdParam) {
                    const recRes = await getPurchaseReceipt(receiptIdParam);
                    if (recRes.success && recRes.data) {
                        const rec = recRes.data as any;
                        if (rec.supplier_id) {
                            setSupplierId(rec.supplier_id);
                            setSupplierName(rec.hms_supplier?.name || '');
                        }
                        if (rec.lines && rec.lines.length > 0) {
                            const loadedLines = rec.lines.map((l: any) => ({
                                id: crypto.randomUUID(),
                                receiptLineId: l.id,
                                productId: l.product_id || '',
                                productName: l.hms_product?.name || l.product_name || 'Unknown',
                                qty: Number(l.qty) || 1,
                                unitPrice: Number(l.unit_price) || 0,
                                batchNo: l.batch_no || 'DIRECT-RET',
                                batchId: l.batch_id || undefined,
                                availableStock: l.hms_product?.totalStock || Number(l.qty),
                                taxRate: Number(l.metadata?.tax_rate || l.hms_product?.metadata?.tax_rate || 0),
                                taxAmount: (Number(l.qty) || 1) * (Number(l.unit_price) || 0) * (Number(l.metadata?.tax_rate || l.hms_product?.metadata?.tax_rate || 0) / 100)
                            }));
                            setItems(loadedLines);
                            setReason(`Return against GRN #${rec.receipt_number || rec.reference || ''}`);
                        }
                    }
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setIsLoading(false);
            }
        }
        init();
    }, [receiptIdParam]);

    const handleAddBlankItem = () => {
        setItems(prev => [...prev, {
            id: crypto.randomUUID(),
            productId: '',
            productName: '',
            qty: 1,
            unitPrice: 0,
            batchNo: 'DIRECT-RET',
            batchId: undefined,
            availableStock: 0,
            taxRate: 0,
            taxAmount: 0
        }]);
    };

    const handleProductSelect = (index: number, pId: string | null, opt: Option | null | undefined) => {
        if (!pId) return;
        const selectedProd = products.find(p => p.id === pId);
        if (!selectedProd) return;

        setItems(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                productId: pId,
                productName: selectedProd.name,
                unitPrice: selectedProd.default_cost || selectedProd.price || 0,
                availableStock: selectedProd.totalStock || 0,
                taxRate: Number((selectedProd.metadata as any)?.tax_rate || selectedProd.taxRate || 0),
                taxAmount: 0
            };
            return next;
        });
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const totalSubtotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + ((item.qty * item.unitPrice) * ((item.taxRate || 0) / 100)), 0);
    const totalReturnAmount = totalSubtotal + totalTaxAmount;

    const handleSubmit = async () => {
        if (!supplierId) {
            toast({ title: "Validation Error", description: "Please select a vendor / supplier.", variant: "destructive" });
            return;
        }

        const validItems = items.filter(i => i.productId && i.qty > 0 && i.unitPrice > 0);
        if (validItems.length === 0) {
            toast({ title: "Validation Error", description: "Please add at least one valid product with quantity and unit price.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                receiptId: receiptIdParam || ("DIRECT_RETURN_" + Date.now()),
                supplierId: supplierId,
                reason: reason || 'Direct Standalone Debit Note',
                items: validItems.map(item => ({
                    receiptLineId: item.receiptLineId || ("DIRECT_LINE_" + item.id),
                    productId: item.productId,
                    qtyToReturn: item.qty,
                    unitPrice: item.unitPrice,
                    batchNo: item.batchNo || 'DIRECT-RET',
                    batchId: item.batchId,
                    taxRate: item.taxRate || 0,
                    taxAmount: (item.qty * item.unitPrice) * ((item.taxRate || 0) / 100)
                }))
            };

            const res = await createPurchaseReturn(payload) as any;
            if (res.error) {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            } else {
                toast({ title: "Success", description: "Direct Purchase Return / Debit Note posted successfully." });
                router.push('/hms/purchasing/returns');
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to post return.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans pb-32">
            {/* Header */}
            <div className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-40 px-8 py-5">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/hms/purchasing/returns')} className="rounded-full hover:bg-muted">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="h-12 w-12 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-red-500/20">
                            <Undo2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">New Direct Purchase Return (Debit Note)</h1>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-0.5">Standalone Return to Vendor</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto p-8 space-y-8">
                {/* Section 1: Vendor & Reason */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-card border border-border rounded-2xl shadow-sm">
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Vendor / Supplier</Label>
                        <SearchableSelect
                            options={suppliers}
                            value={supplierId}
                            onChange={(val, opt) => {
                                setSupplierId(val || '');
                                setSupplierName(opt?.label || '');
                            }}
                            onSearch={async (q) => {
                                const res = await getSuppliersList(q);
                                return (res?.data || []).map(s => ({ id: s.id, label: s.name }));
                            }}
                            placeholder="Search Supplier..."
                            className="h-12 bg-background border-border rounded-xl"
                        />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reason for Return</Label>
                        <Input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g., Rate difference, damaged items, return without GRN..."
                            className="h-12 bg-background border-border text-foreground font-medium rounded-xl"
                        />
                    </div>
                </div>

                {/* Section 2: Items Grid */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                        <div>
                            <h3 className="text-lg font-bold">Return Items List</h3>
                            <p className="text-xs text-muted-foreground font-medium">Select items from inventory and specify return quantity.</p>
                        </div>
                        <Button onClick={handleAddBlankItem} className="h-10 px-5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 flex gap-2">
                            <Plus className="h-4 w-4" /> Add Return Line
                        </Button>
                    </div>

                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <div className="col-span-3">Product Name</div>
                        <div className="col-span-2">Batch Info</div>
                        <div className="col-span-1 text-right">Available Stock</div>
                        <div className="col-span-2 text-center">Return Qty</div>
                        <div className="col-span-1 text-right">Debit Price</div>
                        <div className="col-span-1 text-center">GST %</div>
                        <div className="col-span-1 text-right">Tax Amt</div>
                        <div className="col-span-1 text-right">Total</div>
                    </div>

                    <ScrollArea className="max-h-[500px]">
                        {items.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 opacity-50" />
                                <p className="text-sm font-medium">No return lines added yet.</p>
                                <Button onClick={handleAddBlankItem} variant="outline" className="mt-4 rounded-xl text-xs font-bold">
                                    <Plus className="h-4 w-4 mr-2" /> Add First Item
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                <AnimatePresence>
                                    {items.map((item, idx) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors group"
                                        >
                                            <div className="col-span-3">
                                                <SearchableSelect
                                                    options={productOptions}
                                                    value={item.productId}
                                                    onChange={(val, opt) => handleProductSelect(idx, val, opt)}
                                                    onSearch={async (q) => {
                                                        const res = await getProductsPremium(q, 1, supplierId || undefined);
                                                        return (res?.data || []).map(p => ({ id: p.id, label: `${p.name} (Stock: ${p.totalStock})` }));
                                                    }}
                                                    placeholder="Search product..."
                                                    className="bg-background border-border rounded-lg text-xs"
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <Input
                                                    value={item.batchNo}
                                                    onChange={e => {
                                                        const n = [...items];
                                                        n[idx].batchNo = e.target.value;
                                                        setItems(n);
                                                    }}
                                                    placeholder="Batch No"
                                                    className="h-9 bg-background border-border text-xs font-mono"
                                                />
                                            </div>

                                            <div className="col-span-1 text-right font-bold text-sm text-muted-foreground">
                                                {item.availableStock}
                                            </div>

                                            <div className="col-span-2 flex justify-center">
                                                <Input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={e => {
                                                        const n = [...items];
                                                        n[idx].qty = Math.max(1, parseInt(e.target.value) || 0);
                                                        setItems(n);
                                                    }}
                                                    className="h-9 text-center font-bold bg-background border-border w-24 text-xs font-mono text-red-500"
                                                />
                                            </div>

                                            <div className="col-span-1 text-right">
                                                <Input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={e => {
                                                        const n = [...items];
                                                        n[idx].unitPrice = Math.max(0, parseFloat(e.target.value) || 0);
                                                        setItems(n);
                                                    }}
                                                    className="h-9 text-right font-bold bg-background border-border text-xs font-mono"
                                                />
                                            </div>

                                            <div className="col-span-1 flex justify-center">
                                                <Input
                                                    type="number"
                                                    value={item.taxRate || 0}
                                                    onChange={e => {
                                                        const n = [...items];
                                                        const tr = Math.max(0, parseFloat(e.target.value) || 0);
                                                        n[idx].taxRate = tr;
                                                        n[idx].taxAmount = (n[idx].qty * n[idx].unitPrice) * (tr / 100);
                                                        setItems(n);
                                                    }}
                                                    className="h-9 text-center font-bold bg-background border-border w-16 text-xs font-mono text-amber-500"
                                                />
                                            </div>

                                            <div className="col-span-1 text-right font-mono text-xs font-bold text-muted-foreground">
                                                ₹{((item.qty * item.unitPrice) * ((item.taxRate || 0) / 100)).toFixed(2)}
                                            </div>

                                            <div className="col-span-1 flex items-center justify-end gap-2">
                                                <span className="font-bold text-sm text-foreground font-mono">
                                                    ₹{((item.qty * item.unitPrice) * (1 + (item.taxRate || 0) / 100)).toFixed(2)}
                                                </span>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/80 backdrop-blur-xl px-8 py-5 z-40 shadow-2xl">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">Direct Return Summary</p>
                            <p className="text-xs text-muted-foreground font-medium">Posting this generates an official Debit Note and reduces general inventory stock.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right border-r border-border pr-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal</p>
                            <p className="text-lg font-bold font-mono">
                                ₹{totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right border-r border-border pr-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GST Reversal</p>
                            <p className="text-lg font-bold font-mono text-amber-500">
                                ₹{totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Debit Note</p>
                            <p className="text-2xl font-black text-red-600 font-mono">
                                ₹{totalReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || items.length === 0 || !supplierId}
                            className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 bg-red-600 hover:bg-red-700 text-white flex gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Posting Debit Note...
                                </>
                            ) : (
                                <>
                                    Confirm & Post Debit Note
                                    <ArrowLeftRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
