"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus, Search, Trash2, Receipt, ArrowRight, X,
    Calendar as CalendarIcon, FileText, Sparkles, Loader2, Scan,
    Maximize2, Minimize2, RotateCcw
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SearchableSelect, type Option } from "@/components/ui/searchable-select";
import { Toaster } from "@/components/ui/toaster";
import { getSuppliersList, getProductsPremium, getProduct, findOrCreateProduct } from "@/app/actions/inventory";
import { getPendingPurchaseOrders, createPurchaseReceipt, getPurchaseOrder, getNextReceiptNumber } from "@/app/actions/receipt";
import { motion } from "framer-motion";
import { getCompanyDetails } from "@/app/actions/purchase";
import { scanInvoiceFromUrl as scanInvoiceAction } from "@/app/actions/scan-invoice";
import { ProductCreationDialog } from "@/components/inventory/product-creation-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";

type ReceiptItem = {
    productId: string;
    productName: string;
    poLineId?: string;
    orderedQty?: number;
    pendingQty?: number;
    receivedQty: number;
    unitPrice: number;
    batch: string;
    expiry: string;
    mrp: number;
    salePrice: number;
    marginPct: number;
    markupPct?: number;
    pricingStrategy?: 'manual' | 'mrp_discount';
    mrpDiscountPct?: number;
    taxRate: number;
    taxAmount: number;
    hsn: string;
    packing: string;
    uom?: string;
    schemeDiscount?: number;
    discountPct?: number;
    discountAmt?: number;
    freeQty?: number;
};

interface ReceiptEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const TAX_OPTIONS = [0, 5, 12, 18, 28];

export function ReceiptEntryDialog({ isOpen, onClose, onSuccess }: ReceiptEntryDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProductCreationOpen, setProductCreationOpen] = useState(false);
    const [globalMargin, setGlobalMargin] = useState<number>(100); 

    const [mode, setMode] = useState<'po' | 'direct'>('direct');

    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [supplierName, setSupplierName] = useState('');
    const [supplierMeta, setSupplierMeta] = useState<any>(null);
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [entryDate] = useState(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    const [nextGrn, setNextGrn] = useState('GRN-LOADING...');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');

    const [poId, setPoId] = useState<string | null>(null);
    const [poOptions, setPoOptions] = useState<Option[]>([]);

    const [items, setItems] = useState<ReceiptItem[]>([]);
    const [roundOff, setRoundOff] = useState(0);
    const [isAutoRound, setIsAutoRound] = useState(true);
    const [scannedTotal, setScannedTotal] = useState(0);

    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [companyDetails, setCompanyDetails] = useState<{ gstin?: string, state?: string } | null>(null);
    const [taxType, setTaxType] = useState<'INTRA' | 'INTER'>('INTRA');

    useEffect(() => {
        if (!isOpen) return;
        async function loadData() {
            const details = await getCompanyDetails();
            if (details) setCompanyDetails(details as any);
            const grn = await getNextReceiptNumber();
            setNextGrn(grn);
        }
        loadData();
    }, [isOpen]);

    useEffect(() => {
        if (!supplierMeta?.gstin || !companyDetails?.gstin) {
            setTaxType('INTRA');
            return;
        }
        const supplierStateCode = supplierMeta.gstin.substring(0, 2);
        const companyStateCode = companyDetails.gstin.substring(0, 2);
        setTaxType(supplierStateCode === companyStateCode ? 'INTRA' : 'INTER');
    }, [supplierMeta, companyDetails]);

    useEffect(() => {
        if (!isAutoRound) return;
        const taxable = items.reduce((sum, item) => {
            const baseTotal = item.unitPrice * Number(item.receivedQty);
            const totalDeductions = (item.discountAmt || 0) + (item.schemeDiscount || 0);
            return sum + Math.max(0, baseTotal - totalDeductions);
        }, 0);
        const tax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const rawTotal = taxable + tax;
        const rounded = Math.round(rawTotal);
        setRoundOff(Number((rounded - rawTotal).toFixed(2)));
    }, [items, isAutoRound]);

    const calculateMargin = (salePrice: number, cost: number): number => {
        if (salePrice <= 0) return 0;
        return ((salePrice - cost) / salePrice) * 100;
    };

    const updateLineItemCalcs = (item: ReceiptItem): ReceiptItem => {
        const baseTotal = item.unitPrice * item.receivedQty;
        const deductions = (item.discountAmt || 0) + (item.schemeDiscount || 0);
        const taxable = Math.max(0, baseTotal - deductions);
        const taxAmt = taxable * ((item.taxRate || 0) / 100);
        return { ...item, taxAmount: taxAmt };
    };

    const handleSalePriceChange = (index: number, salePrice: number) => {
        const newItems = [...items];
        const item = newItems[index];
        item.salePrice = salePrice;
        if (item.unitPrice > 0) {
            item.marginPct = Number(calculateMargin(salePrice, item.unitPrice).toFixed(2));
        }
        setItems(newItems);
    };

    const handleMarginChange = (index: number, margin: number) => {
        const n = [...items];
        const item = n[index];
        item.marginPct = margin;
        if (item.unitPrice > 0) {
            const denominator = 1 - margin / 100;
            if (denominator > 0) {
                item.salePrice = Number((item.unitPrice / denominator).toFixed(2));
            }
        }
        setItems(n);
    };

    const handleProductSelect = async (index: number, id: string | null, opt: Option | null | undefined) => {
        const n = [...items];
        n[index].productId = id || "";
        n[index].productName = opt?.label || "";
        if (id) {
            const p = await getProduct(id);
            if (p) {
                n[index].mrp = p.mrp || 0;
                n[index].salePrice = p.price || 0;
                n[index].hsn = p.hsn || "";
                n[index].packing = p.packing || "";
                n[index].uom = p.uom || "PCS";
                n[index].taxRate = p.taxRate || 0;
                n[index] = updateLineItemCalcs(n[index]);
            }
        }
        setItems(n);
    };

    const addItem = () => {
        setItems([...items, {
            productId: "", productName: "", receivedQty: 1, unitPrice: 0, batch: "", expiry: "", mrp: 0, salePrice: 0, marginPct: 0, taxRate: 0, taxAmount: 0, hsn: "", packing: "", freeQty: 0
        }]);
    };

    const searchProducts = async (query: string) => {
        const res = await getProductsPremium(query) as any;
        return res?.data?.map((p: any) => ({ id: p.id, label: p.name, subLabel: p.category })) || [];
    };

    const handleScanInvoice = async (url: string) => {
        setAttachmentUrl(url);
        setIsScanning(true);
        try {
            const res = await scanInvoiceAction(url, supplierId || undefined) as any;
            if (res.data) {
                const { supplierId, supplierName, date, reference: ref, items: scannedItems } = res.data;
                if (supplierName) setSupplierName(supplierName);
                if (supplierId) setSupplierId(supplierId);
                if (date) setReceivedDate(date);
                if (ref) setReference(ref);
            }
        } catch (e) {
            toast({ title: "Scan Failed", variant: "destructive" });
        } finally {
            setIsScanning(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const payload = {
            supplierId, receivedDate: new Date(receivedDate), reference, notes, attachmentUrl,
            items: items.map(i => ({
                productId: i.productId, 
                qtyReceived: i.receivedQty, 
                unitPrice: i.unitPrice, 
                batch: i.batch, 
                expiry: i.expiry, 
                mrp: i.mrp, 
                salePrice: i.salePrice, 
                taxRate: i.taxRate, 
                taxAmount: i.taxAmount, 
                hsn: i.hsn, 
                packing: i.packing, 
                purchaseUOM: i.uom, 
                freeQty: i.freeQty || 0,
                discountAmt: i.discountAmt || 0,
                schemeDiscount: i.schemeDiscount || 0
            }))
        } as any;
        const res = await createPurchaseReceipt(payload) as any;
        if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" });
        else { toast({ title: "Success" }); onSuccess?.(); onClose(); }
        setIsSubmitting(false);
    };

    const totalTaxable = items.reduce((sum, item) => sum + Math.max(0, (item.unitPrice * item.receivedQty) - (item.discountAmt || 0) - (item.schemeDiscount || 0)), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    const netTotal = totalTaxable + totalTax + roundOff;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`p-0 overflow-hidden bg-background border-border flex flex-col transition-all duration-300 ${isMaximized ? 'max-w-none w-screen h-screen rounded-none' : 'max-w-[95vw] w-[1400px] h-[90vh] rounded-2xl shadow-2xl'}`}>
                <Toaster />
                <ProductCreationDialog isOpen={isProductCreationOpen} onClose={() => setProductCreationOpen(false)} />

                {/* Header Row */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <Receipt className="h-5 w-5 text-indigo-400" />
                        <div>
                            <DialogTitle className="text-lg font-bold">New Purchase Entry</DialogTitle>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Industrial Standard GRN</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsMaximized(!isMaximized)}><Maximize2 className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
                    </div>
                </div>

                {/* Primary Metadata Row (32px Layout) */}
                <div className="shrink-0 px-8 py-2 border-b border-border bg-white shadow-sm z-20">
                    <div className="flex items-center gap-3 h-8">
                        <div className="flex-[4]">
                            <SearchableSelect
                                value={supplierId}
                                valueLabel={supplierName}
                                onChange={(id, opt) => { setSupplierId(id); if (opt) setSupplierName(opt.label); }}
                                onSearch={getSuppliersList as any}
                                placeholder="Select Supplier"
                                className="h-8 bg-background border-slate-200 text-[11px] font-bold"
                            />
                        </div>
                        <div className="flex-[3] flex gap-2">
                             <div className="relative flex-1">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-indigo-500 uppercase pointer-events-none">GRN</div>
                                <Input value={nextGrn} readOnly className="h-8 bg-indigo-50/30 border-indigo-100 text-indigo-600 font-mono font-bold pl-10 text-[11px] rounded-md" />
                            </div>
                            <div className="relative flex-1">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase pointer-events-none">DATE</div>
                                <Input value={entryDate} readOnly className="h-8 bg-slate-50 border-slate-200 text-slate-500 font-mono font-bold pl-10 text-[11px] rounded-md opacity-80" />
                            </div>
                        </div>
                        <div className="flex-[3] flex gap-2">
                            <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="h-8 w-32 bg-background border-slate-200 text-[11px] font-bold" />
                            <Input placeholder="Inv / Ref #" value={reference} onChange={(e) => setReference(e.target.value)} className="h-8 flex-1 bg-background border-slate-200 text-[11px] font-bold" />
                        </div>
                        <div className="flex-[2] flex gap-2">
                            <FileUpload onUploadComplete={handleScanInvoice} compact={true} className="h-8 flex-1 border-none bg-indigo-50 text-indigo-600 font-black text-[9px]" />
                            <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0} className="h-8 px-4 bg-indigo-600 hover:bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg">SAVE</Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 px-8 py-3 space-y-3 overflow-hidden bg-slate-50/20">
                     <div className="flex items-center justify-between shrink-0">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Item Manifest</h3>
                        <button onClick={addItem} className="text-[10px] font-black text-indigo-500 flex items-center gap-2 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all">
                            <Plus className="h-3 w-3" /> ADD LINE
                        </button>
                    </div>

                    <div className="flex-1 rounded-xl border border-border bg-white overflow-auto relative">
                        <table className="w-full text-left order-collapse min-w-[2000px]">
                            <thead className="sticky top-0 z-50 bg-slate-50 border-b border-border shadow-sm">
                                <tr className="text-[10px] font-black uppercase text-slate-500">
                                    <th className="py-2 px-6 w-[300px] sticky left-0 bg-slate-50 z-50 border-r">Item Description</th>
                                    <th className="px-2 w-24">Batch</th>
                                    <th className="px-2 w-24">Exp</th>
                                    <th className="px-2 w-24 text-right">MRP</th>
                                    <th className="px-2 w-24 text-right">Sale Price</th>
                                    <th className="px-2 w-24 text-right text-green-600">Margin %</th>
                                    <th className="px-2 w-24 text-right">Basic Price</th>
                                    <th className="px-2 w-20 text-center">Qty</th>
                                    <th className="px-2 w-20 text-center">Free</th>
                                    <th className="px-2 w-20 text-right">Disc %</th>
                                    <th className="px-2 w-20 text-right">Disc Amt</th>
                                    <th className="px-2 w-20 text-right">Scheme</th>
                                    <th className="px-2 w-24">Tax (%)</th>
                                    <th className="px-2 w-24 text-right text-indigo-500">Net Rate</th>
                                    <th className="py-2 pr-6 text-right w-32 sticky right-0 bg-slate-50 border-l font-black text-indigo-600">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const totalUnits = (Number(item.receivedQty) || 0) + (Number(item.freeQty) || 0);
                                    const lineTotal = ((item.unitPrice * item.receivedQty) - (item.discountAmt || 0) - (item.schemeDiscount || 0) + (item.taxAmount || 0));
                                    const netRate = totalUnits > 0 ? lineTotal / totalUnits : 0;
                                    
                                    return (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                                            <td className="py-1 px-6 sticky left-0 bg-white z-20 border-r">
                                                <SearchableSelect value={item.productId} onChange={(id, opt) => handleProductSelect(idx, id, opt)} onSearch={searchProducts} options={item.productId ? [{id: item.productId, label: item.productName}] : []} placeholder="Search Product..." className="h-7 text-[11px] border-none shadow-none font-bold" />
                                            </td>
                                            <td className="px-2"><Input value={item.batch} onChange={(e) => { const n = [...items]; n[idx].batch = e.target.value; setItems(n); }} className="h-7 text-[10px] font-mono border-slate-200" /></td>
                                            <td className="px-2"><Input value={item.expiry} placeholder="MM/YY" onChange={(e) => { const n = [...items]; n[idx].expiry = e.target.value; setItems(n); }} className="h-7 text-[10px] font-mono border-slate-200 text-center" /></td>
                                            <td className="px-2"><Input type="number" value={item.mrp} onChange={(e) => { const n = [...items]; n[idx].mrp = Number(e.target.value); setItems(n); }} className="h-7 text-[10px] text-right font-bold" /></td>
                                            <td className="px-2"><Input type="number" value={item.salePrice} onChange={(e) => handleSalePriceChange(idx, Number(e.target.value))} className="h-7 text-[10px] text-right text-emerald-600 font-bold" /></td>
                                            <td className="px-2"><Input type="number" value={item.marginPct} onChange={(e) => handleMarginChange(idx, Number(e.target.value))} className="h-7 text-[10px] text-right text-green-600 font-bold" /></td>
                                            <td className="px-2"><Input type="number" value={item.unitPrice} onChange={(e) => { const n = [...items]; n[idx].unitPrice = Number(e.target.value); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }} className="h-7 text-[10px] text-right text-indigo-600 font-bold" /></td>
                                            <td className="px-2"><Input type="number" value={item.receivedQty} onChange={(e) => { const n = [...items]; n[idx].receivedQty = Number(e.target.value); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }} className="h-7 text-[10px] text-center font-black bg-slate-50" /></td>
                                            <td className="px-2"><Input type="number" value={item.freeQty} onChange={(e) => { const n = [...items]; n[idx].freeQty = Number(e.target.value); setItems(n); }} className="h-7 text-[10px] text-center font-bold text-orange-500" /></td>
                                            <td className="px-2"><Input type="number" value={item.discountPct} onChange={(e) => { const n = [...items]; n[idx].discountPct = Number(e.target.value); n[idx].discountAmt = (item.unitPrice * item.receivedQty) * (n[idx].discountPct / 100); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }} className="h-7 text-[10px] text-right border-slate-200" /></td>
                                            <td className="px-2"><Input type="number" value={item.discountAmt} onChange={(e) => { const n = [...items]; n[idx].discountAmt = Number(e.target.value); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }} className="h-7 text-[10px] text-right border-slate-200" /></td>
                                            <td className="px-2"><Input type="number" value={item.schemeDiscount} onChange={(e) => { const n = [...items]; n[idx].schemeDiscount = Number(e.target.value); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }} className="h-7 text-[10px] text-right border-slate-200 text-orange-600" /></td>
                                            <td className="px-2">
                                                <Select value={item.taxRate.toString()} onValueChange={(v) => { const n = [...items]; n[idx].taxRate = Number(v); n[idx] = updateLineItemCalcs(n[idx]); setItems(n); }}>
                                                    <SelectTrigger className="h-6 text-[10px] font-mono"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{TAX_OPTIONS.map(v => <SelectItem key={v} value={v.toString()}>{v}%</SelectItem>)}</SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-2 text-right font-mono font-bold text-indigo-500 text-[11px]">
                                                {netRate.toFixed(2)}
                                            </td>
                                            <td className="py-1 pr-6 text-right sticky right-0 bg-white border-l font-mono font-bold text-[11px] text-slate-700">
                                                {lineTotal.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-8 py-4 border-t border-border bg-slate-50 flex items-center justify-between z-10 shrink-0">
                    <div className="flex gap-12">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Taxable Amount</p>
                            <p className="text-lg font-mono font-bold text-slate-700">₹{totalTaxable.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Total Tax</p>
                            <p className="text-lg font-mono font-bold text-indigo-500">₹{totalTax.toFixed(2)}</p>
                        </div>
                        <div className="bg-white px-8 py-1 rounded-xl shadow-inner border border-slate-200">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest text-center">Net Total</p>
                            <p className="text-2xl font-black text-slate-800 tracking-tighter">₹{netTotal.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

