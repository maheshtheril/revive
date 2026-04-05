'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createPurchaseReceipt, getPendingPurchaseOrders, getPurchaseReceipt } from '@/app/actions/receipt';
import { scanInvoiceFromUrl } from '@/app/actions/scan-invoice';
import { searchSuppliers, searchProducts, createProductQuick, getCompanyDetails } from '@/app/actions/purchase';

import { Loader2, Plus, Trash2, ArrowLeft, CheckCircle2, ScanLine, Box, ArrowRight, Settings, FileText } from 'lucide-react';
import { SearchableSelect, type Option } from '@/components/ui/searchable-select';
import { FileUpload } from '@/components/ui/file-upload';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { SupplierDialog } from '@/components/hms/purchasing/supplier-dialog';
import { SupplierPricingDefaults } from '@/components/hms/purchasing/supplier-pricing-defaults';
import { PurchaseReturnDialog } from '@/components/hms/purchasing/purchase-return-dialog';
import { Undo2 } from 'lucide-react';

const PACKING_OPTIONS = ['1 Strip', '1 Box', '1 Bottle', '10x10', '1x10', '1x15', '1 Unit', '1 kg', '1 L'];
const TAX_OPTIONS = ['0', '5', '12', '18', '28'];

type ReceiptItem = {
    id?: string;
    productId: string;
    productName: string;
    poLineId?: string;
    orderedQty?: number;
    pendingQty?: number;
    receivedQty: number;
    unitPrice: number;
    batch?: string;
    expiry?: string;
    mrp?: number;
    salePrice?: number;           // Sale price for this batch
    marginPct?: number;            // Profit margin percentage
    markupPct?: number;            // Markup percentage on cost
    pricingStrategy?: 'mrp_discount' | 'cost_markup' | 'custom' | 'manual';
    mrpDiscountPct?: number;       // Discount % from MRP (e.g., 10 for MRP-10%)
    taxRate?: number;
    taxAmount?: number;
    hsn?: string;
    packing?: string;
    batchId?: string;
    conversionFactor?: number;
};

export default function EditPurchaseReceiptPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const [pricingDefaultsOpen, setPricingDefaultsOpen] = useState(false);
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);

    // Mode: 'po' (Linked to PO) | 'direct' (Ad-hoc)
    const [mode, setMode] = useState<'po' | 'direct'>('po');

    // Header State
    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [supplierName, setSupplierName] = useState('');
    const [supplierMeta, setSupplierMeta] = useState<any>(null); // { gstin, address, contact }
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');

    // PO State
    const [poId, setPoId] = useState<string | null>(null);
    const [poOptions, setPoOptions] = useState<Option[]>([]);

    // Items
    const [items, setItems] = useState<ReceiptItem[]>([]);
    const [roundOff, setRoundOff] = useState(0);
    const [isAutoRound, setIsAutoRound] = useState(true);
    const [scannedTotal, setScannedTotal] = useState(0);

    // Company & Tax Logic
    const [companyDetails, setCompanyDetails] = useState<{ gstin?: string, state?: string } | null>(null);
    const [taxType, setTaxType] = useState<'INTRA' | 'INTER'>('INTRA');

    // Load Company Details for Tax Logic
    useEffect(() => {
        async function loadCompany() {
            const details = await getCompanyDetails();
            if (details) {
                setCompanyDetails(details);
            }
        }
        loadCompany();
    }, []);

    // Determine Tax Type (Intra vs Inter)
    useEffect(() => {
        if (!supplierMeta?.gstin || !companyDetails?.gstin) {
            setTaxType('INTRA'); // Default
            return;
        }

        // Logic: First 2 digits of GSTIN represent State Code
        const supplierStateCode = supplierMeta.gstin.substring(0, 2);
        const companyStateCode = companyDetails.gstin.substring(0, 2);

        if (supplierStateCode === companyStateCode) {
            setTaxType('INTRA');
        } else {
            setTaxType('INTER');
        }
    }, [supplierMeta, companyDetails]);

    // Auto-apply supplier pricing defaults when supplier changes
    useEffect(() => {
        if (!supplierMeta?.pricing_defaults || items.length === 0) return;

        const defaults = supplierMeta.pricing_defaults;
        if (!defaults.defaultPricingStrategy || defaults.defaultPricingStrategy === 'none') return;

        // Only auto-apply to items that don't have sale price set yet
        const newItems = items.map(item => {
            if (item.salePrice) return item; // Skip already priced items
            if (!item.mrp && !item.unitPrice) return item; // Skip items without price info

            let salePrice = 0;
            let strategy = defaults.defaultPricingStrategy;

            if (strategy === 'mrp_discount' && item.mrp && defaults.defaultMrpDiscountPct) {
                salePrice = Number((item.mrp * (1 - defaults.defaultMrpDiscountPct / 100)).toFixed(2));
            } else if (strategy === 'cost_markup' && item.unitPrice && defaults.defaultMarkupPct) {
                salePrice = Number((item.unitPrice * (1 + defaults.defaultMarkupPct / 100)).toFixed(2));
                // Validate against MRP if exists
                if (item.mrp && salePrice > item.mrp) {
                    salePrice = item.mrp;
                }
            }

            if (salePrice > 0 && item.unitPrice) {
                return {
                    ...item,
                    salePrice,
                    pricingStrategy: strategy as any,
                    marginPct: Number(calculateMargin(salePrice, item.unitPrice).toFixed(2)),
                    markupPct: Number(calculateMarkup(salePrice, item.unitPrice).toFixed(2)),
                };
            }

            return item;
        });

        setItems(newItems);
    }, [supplierId, items.length]); // Trigger when supplier or item count changes

    // Auto-calculate Round Off when items change
    useEffect(() => {
        if (!isAutoRound) return; // Skip if manual mode

        const taxable = items.reduce((sum, item) => sum + (item.unitPrice * Number(item.receivedQty)), 0);
        const tax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        const rawTotal = taxable + tax;
        const rounded = Math.round(rawTotal);
        const diff = rounded - rawTotal;
        setRoundOff(Number(diff.toFixed(2)));
    }, [items]);

    // Load Receipt Data on Mount
    useEffect(() => {
        async function loadReceipt() {
            if (!params.id) return;
            try {
                const res = await getPurchaseReceipt(params.id);
                if (res.success && res.data) {
                    const r = res.data;
                    setSupplierId(r.supplierId || null);
                    setSupplierName(r.supplierName);
                    setReceivedDate(r.date ? new Date(r.date).toISOString().split('T')[0] : '');
                    setReference(r.reference);
                    setReference(r.reference);
                    setNotes(r.notes);
                    setAttachmentUrl(r.attachmentUrl || '');

                    if (r.items) {
                        setItems(r.items.map((i: any) => ({
                            id: i.id,
                            productId: i.productId,
                            productName: i.productName,
                            receivedQty: i.qty,
                            unitPrice: i.unitPrice,
                            batch: i.batch,
                            batchId: i.batchId,
                            expiry: i.expiry,
                            mrp: i.mrp,
                            salePrice: i.salePrice,
                            marginPct: i.marginPct,
                            markupPct: i.markupPct,
                            pricingStrategy: i.pricingStrategy || 'manual',
                            mrpDiscountPct: i.mrpDiscountPct,
                            packing: i.pack || i.packing,  // Fixed: use 'packing' field name
                            taxRate: i.taxRate,
                            taxAmount: (i.qty * i.unitPrice * (i.taxRate / 100)),
                            hsn: i.hsn,
                            conversionFactor: i.conversionFactor,
                            pendingQty: 0,
                            orderedQty: 0
                        })));
                    }
                    setMode('direct'); // Default to direct for editing
                    toast({ title: "Loaded", description: `Receipt ${r.number} loaded.` });
                } else {
                    toast({ title: "Error", description: res.error || "Receipt not found", variant: "destructive" });
                }
            } catch (err) {
                console.error(err);
                toast({ title: "Error", description: "Failed to load receipt", variant: "destructive" });
            }
        }
        loadReceipt();
    }, [params.id]);

    // Load POs on mount (keeping this for context if needed)
    useEffect(() => {
        async function loadPos() {
            const res = await getPendingPurchaseOrders();
            if (res && res.data) {
                setPoOptions(res.data.map((po: any) => ({ id: po.id, label: `${po.poNumber} - ${po.supplierName}` })));
            }
        }
        loadPos();
    }, []);

    // Also fetch full PO details if mode switches back to PO and ID is selected? 
    // Simplified: handle selection
    const handlePoSelect = async (id: string | null, opt: Option | null | undefined) => {
        setPoId(id);
        if (!id) {
            // If cleared, maybe clear items?
            return;
        }

        // Import dynamically to avoid circle or ensure loaded? No, standardized import.
        // We need to fetch details. We just added getPurchaseOrder to actions.
        // But we need to update import first or use distinct name if not imported.
        // Since I can't easily change imports in this block without touching top of file,
        // I will assume I can import it or use a separate effect. 
        // Wait, I can't import inside specific function easily for actions unless dynamic.

        try {
            // Dynamic import for the new action we just added to avoid updating top of file
            const { getPurchaseOrder } = await import('@/app/actions/receipt');
            const res = await getPurchaseOrder(id);

            if (res.data) {
                if (res.data.supplierId) setSupplierId(res.data.supplierId);

                setItems(res.data.items.map((i: any) => ({
                    productId: i.productId,
                    productName: i.productName,
                    poLineId: i.poLineId,
                    orderedQty: i.orderedQty,
                    pendingQty: i.pendingQty,
                    receivedQty: i.pendingQty, // Default to receiving all pending
                    unitPrice: i.unitPrice
                })));
                toast({ title: "PO Loaded", description: "Items populated from order." });
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to load PO details", variant: "destructive" });
        }
    };

    // ========== PRICING CALCULATION HELPERS ==========

    const calculateMargin = (salePrice: number, cost: number): number => {
        if (salePrice <= 0) return 0;
        return ((salePrice - cost) / salePrice) * 100;
    };

    const calculateMarkup = (salePrice: number, cost: number): number => {
        if (cost <= 0) return 0;
        return ((salePrice - cost) / cost) * 100;
    };

    const handlePricingStrategyChange = (index: number, strategy: string) => {
        const newItems = [...items];
        const item = newItems[index];
        item.pricingStrategy = strategy as any;

        // Apply the strategy
        if (strategy === 'mrp_discount' && item.mrp) {
            const discountPct = item.mrpDiscountPct || 10; // Default 10%
            item.salePrice = Number((item.mrp * (1 - discountPct / 100)).toFixed(2));
        } else if (strategy === 'cost_markup' && item.unitPrice) {
            const markupPct = item.markupPct || 25; // Default 25%
            item.salePrice = Number((item.unitPrice * (1 + markupPct / 100)).toFixed(2));
        }

        // Recalculate margin and markup
        if (item.salePrice && item.unitPrice) {
            item.marginPct = Number(calculateMargin(item.salePrice, item.unitPrice).toFixed(2));
            item.markupPct = Number(calculateMarkup(item.salePrice, item.unitPrice).toFixed(2));
        }

        setItems(newItems);
    };

    const handleSalePriceChange = (index: number, salePrice: number) => {
        const newItems = [...items];
        const item = newItems[index];

        // Validation: Sale price cannot exceed MRP
        if (item.mrp && salePrice > item.mrp) {
            toast({
                title: "Invalid Price",
                description: `Sale price (₹${salePrice}) cannot exceed MRP (₹${item.mrp}). This violates India's Legal Metrology Act.`,
                variant: "destructive"
            });
            return;
        }

        item.salePrice = salePrice;
        item.pricingStrategy = 'manual';

        // Auto-calculate margin and markup
        if (item.unitPrice > 0) {
            item.marginPct = Number(calculateMargin(salePrice, item.unitPrice).toFixed(2));
            item.markupPct = Number(calculateMarkup(salePrice, item.unitPrice).toFixed(2));
        }

        // Warn if margin is too low
        if (item.marginPct !== undefined && item.marginPct < 10) {
            toast({
                title: "Low Margin Warning",
                description: `Margin is only ${item.marginPct.toFixed(1)}%. Consider increasing the sale price.`,
                variant: "default"
            });
        }

        setItems(newItems);
    };

    const handleMRPDiscountChange = (index: number, discountPct: number) => {
        const newItems = [...items];
        const item = newItems[index];

        if (!item.mrp) {
            toast({ title: "MRP Required", description: "Please enter MRP first", variant: "destructive" });
            return;
        }

        item.mrpDiscountPct = discountPct;
        item.salePrice = Number((item.mrp * (1 - discountPct / 100)).toFixed(2));
        item.pricingStrategy = 'mrp_discount';

        // Recalculate margins
        if (item.unitPrice > 0) {
            item.marginPct = Number(calculateMargin(item.salePrice, item.unitPrice).toFixed(2));
            item.markupPct = Number(calculateMarkup(item.salePrice, item.unitPrice).toFixed(2));
        }

        setItems(newItems);
    };

    const handleMarkupPctChange = (index: number, markupPct: number) => {
        const newItems = [...items];
        const item = newItems[index];

        if (!item.unitPrice || item.unitPrice <= 0) {
            toast({ title: "Cost Required", description: "Please enter purchase cost first", variant: "destructive" });
            return;
        }

        item.markupPct = markupPct;
        item.salePrice = Number((item.unitPrice * (1 + markupPct / 100)).toFixed(2));
        item.pricingStrategy = 'cost_markup';

        // Validate against MRP
        if (item.mrp && item.salePrice > item.mrp) {
            toast({
                title: "Exceeds MRP",
                description: `Calculated sale price (₹${item.salePrice}) exceeds MRP (₹${item.mrp}). Adjusting to MRP.`,
                variant: "default"
            });
            item.salePrice = item.mrp;
        }

        // Recalculate margin
        item.marginPct = Number(calculateMargin(item.salePrice, item.unitPrice).toFixed(2));

        setItems(newItems);
    };

    const applyQuickMargin = (marginTemplate: 'mrp-5' | 'mrp-10' | 'mrp-15' | 'mrp-20') => {
        const discountPct = parseInt(marginTemplate.split('-')[1]);
        const newItems = items.map(item => {
            if (item.mrp && item.mrp > 0) {
                const salePrice = Number((item.mrp * (1 - discountPct / 100)).toFixed(2));
                return {
                    ...item,
                    salePrice,
                    mrpDiscountPct: discountPct,
                    pricingStrategy: 'mrp_discount' as any,
                    marginPct: item.unitPrice > 0 ? Number(calculateMargin(salePrice, item.unitPrice).toFixed(2)) : undefined,
                    markupPct: item.unitPrice > 0 ? Number(calculateMarkup(salePrice, item.unitPrice).toFixed(2)) : undefined,
                };
            }
            return item;
        });
        setItems(newItems);
        toast({ title: "Pricing Applied", description: `MRP-${discountPct}% applied to all items with MRP` });
    };

    // ========== END PRICING HELPERS ==========

    const handleProductSelect = (index: number, productId: string | null, opt: Option | null | undefined) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            productId: productId || "",
            productName: opt?.label || ""
        };
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, {
            productId: "",
            productName: "",
            receivedQty: 1,
            unitPrice: 0,
            pendingQty: 0,
            orderedQty: 0
        }]);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submit button clicked");
        setIsSubmitting(true);

        // Validation: Round Off
        console.log("Checking Round Off:", roundOff);
        if (Math.abs(roundOff) > 0.5) {
            console.warn("Round Off Validation Failed");
            toast({
                title: "Validation Error",
                description: "Round Off amount cannot exceed +/- 0.50. Please adjust item prices or taxes.",
                variant: "destructive"
            });
            setIsSubmitting(false);
            return;
        }

        const validItems = items.filter(i => i.receivedQty > 0 && i.productId);
        console.log("Valid Items Count:", validItems.length);

        if (validItems.length === 0) {
            console.warn("No valid items found");
            toast({ title: "Error", description: "No valid items to receive.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const payload = {
            supplierId: supplierId || undefined,
            purchaseOrderId: mode === 'po' ? poId : null,
            receivedDate: new Date(receivedDate),
            reference,
            notes,
            attachmentUrl,
            items: validItems.map(i => ({
                id: i.id, // Pass ID for updates
                productId: i.productId,
                poLineId: i.poLineId,
                qtyReceived: Number(i.receivedQty),
                unitPrice: Number(i.unitPrice),
                batch: i.batch,
                expiry: i.expiry,
                mrp: Number(i.mrp),
                salePrice: i.salePrice ? Number(i.salePrice) : undefined,
                marginPct: i.marginPct ? Number(i.marginPct) : undefined,
                markupPct: i.markupPct ? Number(i.markupPct) : undefined,
                pricingStrategy: i.pricingStrategy,
                taxRate: Number(i.taxRate),
                taxAmount: Number(i.taxAmount),
                hsn: i.hsn,
                packing: i.packing,
                conversionFactor: i.conversionFactor
            }))
        };

        if (params.id) {
            const { updatePurchaseReceipt } = await import('@/app/actions/receipt');
            const res = await updatePurchaseReceipt(params.id, payload);
            if (res.error) {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            } else {
                toast({ title: "Updated", description: "Receipt updated successfully." });
                setTimeout(() => router.push('/hms/purchasing/receipts'), 1000);
            }
        } else {
            const res = await createPurchaseReceipt(payload);
            if (res.error) {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            } else {
                toast({ title: "Success", description: "Goods received successfully." });
                setTimeout(() => router.push('/hms/purchasing/receipts'), 1000); // Fixed redirect to list
            }
        }
        setIsSubmitting(false);
    };

    const totalTaxable = items.reduce((sum, item) => sum + (item.unitPrice * Number(item.receivedQty)), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    const netTotal = totalTaxable + totalTax + roundOff;

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-indigo-500/30 selection:text-indigo-200 font-sans">
            <Toaster />
            <SupplierDialog
                isOpen={supplierDialogOpen}
                onClose={() => setSupplierDialogOpen(false)}
                onSuccess={(newSupplier) => {
                    setSupplierId(newSupplier.id);
                    setSupplierName(newSupplier.label);
                    // Also clear previous meta if new supplier created, or fetch it if possible (though quick create might not return all)
                    setSupplierMeta({ gstin: newSupplier.subLabel, address: undefined, contact: undefined });
                    toast({ title: "Supplier Created", description: `${newSupplier.label} has been selected.` });
                }}
            />

            {/* Supplier Pricing Defaults Dialog */}
            <SupplierPricingDefaults
                isOpen={pricingDefaultsOpen}
                onClose={() => setPricingDefaultsOpen(false)}
                supplierId={supplierId || ''}
                supplierName={supplierName}
                currentDefaults={supplierMeta?.pricing_defaults}
                onSave={async (defaults) => {
                    // Update supplier metadata with pricing defaults
                    // This would call a server action to update the supplier
                    toast({
                        title: "Pricing Defaults Saved",
                        description: `Default pricing for ${supplierName} has been configured.`
                    });
                    // Optionally refresh supplier data
                }}
            />

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="h-6 w-px bg-border mx-2"></div>
                        <h1 className="text-sm font-bold tracking-wide text-foreground uppercase">Edit Purchase Entry <span className="text-muted-foreground font-mono ml-2">#{params.id.split('-').pop()}</span></h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setIsReturnDialogOpen(true)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm active:scale-95"
                        >
                            <Undo2 className="h-4 w-4" />
                            Record Return
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-40 max-w-[1600px] mx-auto px-8">
                <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-12">

                    {/* Left Panel: Context - The "Document Header" */}
                    <div className="col-span-12 lg:col-span-4 space-y-12 animate-in fade-in slide-in-from-left-4 duration-700">

                        {/* 1. View Mode Selection - PROMINENT */}
                        <div className="bg-muted p-1.5 rounded-xl border border-border flex gap-1 mb-8">
                            <button
                                type="button"
                                onClick={() => setMode('po')}
                                className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${mode === 'po'
                                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 scale-[1.02]'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }`}
                            >
                                <ScanLine className="h-4 w-4" />
                                PO Mode
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('direct')}
                                className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${mode === 'direct'
                                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 scale-[1.02]'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }`}
                            >
                                <Plus className="h-4 w-4" />
                                Direct Mode
                            </button>
                        </div>

                        {/* 2. Supplier - The "Who" */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Received From</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSupplierDialogOpen(true)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                                    >
                                        <Plus className="h-3 w-3" /> New
                                    </button>
                                    {supplierId && (
                                        <button
                                            type="button"
                                            onClick={() => setPricingDefaultsOpen(true)}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
                                            title="Configure default pricing for this supplier"
                                        >
                                            <Settings className="h-3 w-3" /> Pricing
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="group relative">
                                <SearchableSelect
                                    value={supplierId}
                                    options={useMemo(() => supplierId ? [{ id: supplierId, label: supplierName, subLabel: supplierMeta?.gstin }] : [], [supplierId, supplierName, supplierMeta?.gstin])}
                                    onChange={(id, opt) => { setSupplierId(id); setSupplierName(opt?.label || ''); }}
                                    onSearch={searchSuppliers}
                                    placeholder="Select Vendor..."
                                    className="w-full bg-transparent border-none text-2xl font-black placeholder:text-muted/30 p-0 focus:ring-0"
                                    variant="ghost"
                                />
                                <div className="h-0.5 w-full bg-muted absolute bottom-0 left-0 group-focus-within:bg-blue-500 transition-colors duration-500"></div>
                            </div>

                            {/* Extracted Supplier Meta Display */}
                            {supplierMeta && (
                                <div className="bg-muted/50 rounded-xl p-6 border border-border space-y-3 text-xs text-muted-foreground shadow-inner">
                                    {supplierMeta.gstin && <div className="flex justify-between"><span>GSTIN:</span> <span className="text-foreground font-mono font-bold">{supplierMeta.gstin}</span></div>}
                                    {supplierMeta.address && <div className="flex justify-between gap-4"><span>Address:</span> <span className="text-foreground text-right">{supplierMeta.address}</span></div>}
                                    {supplierMeta.contact && <div className="flex justify-between"><span>Contact:</span> <span className="text-foreground font-bold">{supplierMeta.contact}</span></div>}
                                </div>
                            )}
                        </div>

                        {/* 2. Source Document - The "Why" */}
                        {mode === 'po' && (
                            <div className={`space-y-4 transition-all duration-500 ${!supplierId ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100'}`}>
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                    <ScanLine className="h-3 w-3" /> Source Document
                                </label>
                                <div className="group relative">
                                    <SearchableSelect
                                        value={poId}
                                        onChange={(id, opt) => handlePoSelect(id, opt)}
                                        onSearch={async (q) => poOptions.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))}
                                        placeholder="Search Purchase Order..."
                                        className="w-full bg-transparent border-none text-2xl font-black text-foreground placeholder:text-muted/30 p-0 focus:ring-0 font-mono"
                                        variant="ghost"
                                    />
                                    <div className="h-0.5 w-full bg-muted absolute bottom-0 left-0 group-focus-within:bg-blue-500 transition-colors duration-500"></div>
                                </div>
                                {poId && <div className="text-xs text-emerald-500 font-medium">✓ Items loaded from order</div>}
                            </div>
                        )}

                        {/* 3. Meta Data - The "When/What" */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    value={receivedDate}
                                    onChange={(e) => setReceivedDate(e.target.value)}
                                    className="w-full bg-transparent border-b border-muted focus:border-blue-500 p-0 pb-2 text-base font-bold text-foreground focus:ring-0 transition-colors"
                                />
                            </div>
                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Reference</label>
                                <input
                                    type="text"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    placeholder="e.g. GT-8821"
                                    className="w-full bg-transparent border-b border-muted focus:border-blue-500 p-0 pb-2 text-base font-bold text-foreground focus:ring-0 transition-colors placeholder:text-muted/30"
                                />
                            </div>
                        </div>

                        {/* 4. Attachments */}
                        <div className="space-y-4 pt-4 border-t border-border">
                            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoice / Attachment</label>
                            <FileUpload
                                onUploadComplete={async (url) => {
                                    setAttachmentUrl(url);
                                    if (url) {
                                        // Trigger AI Scan
                                        toast({ title: "Analyzing Invoice...", description: "Extracting data from your document..." });

                                        // Dynamic import or ensure action is available
                                        const { scanInvoiceFromUrl } = await import('@/app/actions/scan-invoice');
                                        console.log("Calling scanInvoiceFromUrl...", url);
                                        const res = await scanInvoiceFromUrl(url);
                                        console.log("Scan Result Client-Side:", res);

                                        if (!('error' in res) && res.data) {
                                            const { supplierId, supplierName, date, reference, items: scannedItems } = res.data;

                                            console.log("Mapping Items:", scannedItems);

                                            // 1. Auto-select mode to Direct (since it's an invoice upload usually)
                                            setMode('direct');

                                            // 2. Set Header Data
                                            if (supplierId) {
                                                setSupplierId(supplierId);
                                                setSupplierName(supplierName);
                                                setSupplierMeta({
                                                    gstin: res.data.gstin,
                                                    address: res.data.address,
                                                    contact: res.data.contact
                                                });
                                            }
                                            if (date) setReceivedDate(date);
                                            if (reference) setReference(reference);

                                            // 3. Populate Items
                                            if (scannedItems && scannedItems.length > 0) {
                                                const mappedItems = scannedItems.map((item: any) => {
                                                    const qty = Number(String(item.qty || 0).replace(/[^0-9.-]/g, '')) || 0;
                                                    const unitPrice = Number(String(item.unitPrice || 0).replace(/[^0-9.-]/g, '')) || 0;
                                                    const taxRate = Number(String(item.taxRate || 0).replace(/[^0-9.-]/g, '')) || 0;
                                                    const taxAmount = (qty * unitPrice * (taxRate / 100));

                                                    return {
                                                        productId: item.productId,
                                                        productName: item.productName,
                                                        receivedQty: qty,
                                                        unitPrice: unitPrice,
                                                        pendingQty: 0,
                                                        orderedQty: 0,
                                                        batch: item.batch,
                                                        expiry: item.expiry,
                                                        mrp: Number(String(item.mrp || 0).replace(/[^0-9.-]/g, '')) || 0,
                                                        taxRate: taxRate,
                                                        taxAmount: taxAmount,
                                                        hsn: item.hsn,
                                                        packing: item.packing
                                                    };
                                                });
                                                setItems(mappedItems);

                                                // 4. Smart Rounding: Match the PDF's Grand Total exactly
                                                if (res.data.grandTotal) {
                                                    const extractedTotal = Number(res.data.grandTotal);
                                                    setScannedTotal(extractedTotal);

                                                    // Re-calculate local total for these items
                                                    const localTaxable = mappedItems.reduce((sum: number, item: any) => sum + (item.unitPrice * item.receivedQty), 0);
                                                    const localTax = mappedItems.reduce((sum: number, item: any) => sum + (item.taxAmount || 0), 0);
                                                    const localTotal = localTaxable + localTax;

                                                    const diff = extractedTotal - localTotal;

                                                    // If there's a difference, assume it's round off, set it, and LOCK auto-round to false (Manual)
                                                    // to preserver the document's truth.
                                                    if (Math.abs(diff) <= 0.5) {
                                                        setRoundOff(Number(diff.toFixed(2)));
                                                        setIsAutoRound(false);
                                                        toast({ description: `Round off adjusted to match Invoice Total: ${extractedTotal}` });
                                                    } else {
                                                        setRoundOff(0);
                                                        setIsAutoRound(true);
                                                        toast({
                                                            title: "Total Mismatch Warning",
                                                            description: `Invoice Total (${extractedTotal}) differs from calculated (${localTotal.toFixed(2)}) by ${diff.toFixed(2)}. Please check item prices/taxes.`,
                                                            variant: "destructive"
                                                        });
                                                    }
                                                }

                                            } else {
                                                toast({ title: "Warning", description: "Invoice scanned but no items found.", variant: "default" });
                                            }

                                            toast({ title: "Invoice Extract Success", description: "Data auto-filled. Please review the items below." });
                                        } else {
                                            console.error("Scan Failed:", 'error' in res ? res.error : 'Unknown error');
                                            toast({
                                                title: "Scan Failed",
                                                description: ('error' in res ? res.error : undefined) || "Could not read invoice data.",
                                                variant: "destructive"
                                            });
                                        }
                                    }
                                }}
                                folder="invoices"
                                label="Upload Invoice PDF (Auto-Scan)"
                                accept="application/pdf,image/*"
                            />
                            {attachmentUrl && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                                    <FileText className="h-4 w-4 text-blue-400" />
                                    <span className="text-xs text-muted-foreground">Original Document Available</span>
                                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-bold text-blue-500 hover:text-blue-600 hover:underline">
                                        View File ↗
                                    </a>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Panel: Items Grid */}
                    <div className="col-span-12 lg:col-span-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
                        <div className="flex items-center justify-between px-2 text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Box className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-black uppercase tracking-widest text-foreground">Manifest</span>
                            </div>
                            {mode === 'direct' && (
                                <button type="button" onClick={addItem} className="text-xs font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                                    <Plus className="h-4 w-4" /> Add Line Item
                                </button>
                            )}
                        </div>

                        {/* Quick Pricing Templates */}
                        {items.length > 0 && items.some(i => i.mrp && i.mrp > 0) && (
                            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                                <span className="text-xs text-emerald-400 font-medium">Quick Apply:</span>
                                <button
                                    type="button"
                                    onClick={() => applyQuickMargin('mrp-5')}
                                    className="px-3 py-1 text-xs rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors font-mono"
                                >
                                    MRP - 5%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyQuickMargin('mrp-10')}
                                    className="px-3 py-1 text-xs rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors font-mono"
                                >
                                    MRP - 10%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyQuickMargin('mrp-15')}
                                    className="px-3 py-1 text-xs rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors font-mono"
                                >
                                    MRP - 15%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyQuickMargin('mrp-20')}
                                    className="px-3 py-1 text-xs rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors font-mono"
                                >
                                    MRP - 20%
                                </button>
                                <span className="text-xs text-neutral-500 ml-2">
                                    Applies to {items.filter(i => i.mrp && i.mrp > 0).length} items
                                </span>
                            </div>
                        )}

                        <div className="min-h-[400px] rounded-2xl border border-border bg-muted/20 overflow-x-auto shadow-xl shadow-black/5 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                            <table className="w-full text-left border-collapse min-w-[1400px]">
                                <thead className="bg-muted/50">
                                    <tr className="border-b border-border text-muted-foreground">
                                        <th className="py-4 pl-4 font-black text-[10px] uppercase tracking-widest w-[20%] text-foreground">Product Details</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-left w-16 text-foreground">HSN</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-left w-24 text-foreground">Pack</th>
                                        {mode === 'po' && <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-center w-16 text-foreground">Ord</th>}
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-left w-24 text-foreground">Batch</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-left w-24 text-foreground">Exp</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-foreground">MRP</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-24 text-emerald-600">Sale Price</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-emerald-600">Margin</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-foreground">Qty</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-24 text-foreground">Price/Rate</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-24 text-foreground">Taxable</th>
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-16 text-foreground">Tax%</th>
                                        {taxType === 'INTRA' ? (
                                            <>
                                                <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-foreground">CGST</th>
                                                <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-foreground">SGST</th>
                                            </>
                                        ) : (
                                            <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-20 text-foreground">IGST</th>
                                        )}
                                        <th className="py-4 px-2 font-black text-[10px] uppercase tracking-widest text-right w-28 text-foreground">Net Total</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {items.map((item, index) => (
                                        <tr key={index} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 pl-4">
                                                {mode === 'po' ? (
                                                    <div className="py-2">
                                                        <div className="text-sm font-bold text-foreground uppercase tracking-tight">{item.productName}</div>
                                                        {item.poLineId && <div className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60">ID: {item.poLineId.split('-').pop()}</div>}
                                                    </div>
                                                ) : (
                                                    <SearchableSelect
                                                        value={item.productId}
                                                        onChange={(id, opt) => handleProductSelect(index, id, opt)}
                                                        onSearch={searchProducts}
                                                        onCreate={createProductQuick}
                                                        options={item.productId ? [{ id: item.productId, label: item.productName }] : []}
                                                        placeholder={item.productName || "Search Product..."}
                                                        variant="ghost"
                                                        className="w-full text-sm font-bold text-foreground placeholder:text-muted/30"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-3 px-2">
                                                <input
                                                    placeholder="HSN"
                                                    value={item.hsn || ''}
                                                    onChange={(e) => { const n = [...items]; n[index].hsn = e.target.value; setItems(n); }}
                                                    className="w-full bg-transparent border-b border-border text-[10px] font-mono focus:border-blue-500 font-bold text-foreground"
                                                />
                                            </td>
                                            <td className="py-3 px-2">
                                                <SearchableSelect
                                                    value={item.packing}
                                                    onChange={(id, opt) => {
                                                        const n = [...items];
                                                        n[index].packing = opt?.label || id || '';
                                                        setItems(n);
                                                    }}
                                                    onSearch={async (q) => PACKING_OPTIONS.filter(o => o.toLowerCase().includes(q.toLowerCase())).map(o => ({ id: o, label: o }))}
                                                    onCreate={async (q) => ({ id: q, label: q })}
                                                    options={[
                                                        ...PACKING_OPTIONS.map(o => ({ id: o, label: o })),
                                                        ...(item.packing && !PACKING_OPTIONS.includes(item.packing) ? [{ id: item.packing, label: item.packing }] : [])
                                                    ]}
                                                    placeholder="Pack"
                                                    variant="ghost"
                                                    className="w-full text-[10px] font-bold font-mono text-foreground placeholder:text-muted/30"
                                                />
                                            </td>
                                            {mode === 'po' && (
                                                <td className="py-3 px-2 text-center">
                                                    <span className="text-xs font-mono text-neutral-500">{item.orderedQty}</span>
                                                </td>
                                            )}
                                            <td className="py-3 px-2">
                                                <input
                                                    placeholder="Batch"
                                                    value={item.batch || ''}
                                                    onChange={(e) => { const n = [...items]; n[index].batch = e.target.value; setItems(n); }}
                                                    className="w-full bg-transparent border-b border-border text-[10px] font-mono focus:border-blue-500 font-bold text-foreground"
                                                />
                                            </td>
                                            <td className="py-3 px-2">
                                                <input
                                                    placeholder="Exp"
                                                    value={item.expiry || ''}
                                                    onChange={(e) => { const n = [...items]; n[index].expiry = e.target.value; setItems(n); }}
                                                    className="w-full bg-transparent border-b border-border text-[10px] font-mono focus:border-blue-500 font-bold text-foreground"
                                                />
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                <input
                                                    placeholder="MRP"
                                                    type="number"
                                                    value={item.mrp || ''}
                                                    onChange={(e) => { const n = [...items]; n[index].mrp = Number(e.target.value); setItems(n); }}
                                                    className="w-full bg-transparent border-b border-border text-[10px] font-mono text-right focus:border-blue-500 font-bold text-foreground"
                                                />
                                            </td>
                                            {/* Sale Price - Editable with MRP validation */}
                                            <td className="py-3 px-2 text-right">
                                                <input
                                                    placeholder="Sale"
                                                    type="number"
                                                    step="0.01"
                                                    value={item.salePrice || ''}
                                                    onChange={(e) => {
                                                        const salePrice = Number(e.target.value);
                                                        handleSalePriceChange(index, salePrice);
                                                    }}
                                                    className={`w-full bg-transparent border-b text-[10px] font-mono text-right focus:border-emerald-500 ${item.mrp && item.salePrice && item.salePrice > item.mrp
                                                        ? 'border-red-500 text-red-400'
                                                        : 'border-emerald-500/30 text-emerald-300'
                                                        }`}
                                                />
                                                <div className="text-[8px] text-neutral-600 mt-0.5">
                                                    {item.mrp && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMRPDiscountChange(index, 10)}
                                                            className="hover:text-emerald-400 transition-colors"
                                                        >
                                                            MRP-10%
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Margin % - Auto-calculated, color-coded */}
                                            <td className="py-3 px-2 text-right">
                                                <div className={`text-xs font-black ${!item.marginPct ? 'text-muted-foreground' :
                                                    item.marginPct >= 25 ? 'text-emerald-600' :
                                                        item.marginPct >= 15 ? 'text-blue-600' :
                                                            item.marginPct >= 10 ? 'text-orange-600' :
                                                                'text-rose-600'
                                                    }`}>
                                                    {item.marginPct !== undefined ? `${item.marginPct.toFixed(1)}%` : '-'}
                                                </div>
                                                {item.marginPct !== undefined && item.marginPct < 10 && (
                                                    <div className="text-[8px] text-rose-500 font-bold">LOW</div>
                                                )}
                                            </td>

                                            <td className="py-3 px-2 text-right">
                                                <input
                                                    type="number"
                                                    value={item.receivedQty}
                                                    onChange={(e) => {
                                                        const n = [...items];
                                                        const qty = Number(e.target.value);
                                                        n[index].receivedQty = qty;
                                                        // Auto-calc tax amount
                                                        const taxable = qty * n[index].unitPrice;
                                                        n[index].taxAmount = taxable * ((n[index].taxRate || 0) / 100);
                                                        setItems(n);
                                                    }}
                                                    className="w-full bg-transparent border-b border-border text-center font-mono font-bold text-foreground focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => {
                                                        const n = [...items];
                                                        const price = Number(e.target.value);
                                                        n[index].unitPrice = price;
                                                        // Auto-calc tax amount
                                                        const taxable = n[index].receivedQty * price;
                                                        n[index].taxAmount = taxable * ((n[index].taxRate || 0) / 100);
                                                        setItems(n);
                                                    }}
                                                    className="w-full bg-transparent border-b border-border text-right font-mono font-bold text-foreground focus:border-blue-500"
                                                />
                                            </td>

                                            {/* Taxable Value (Calculated) */}
                                            <td className="py-3 px-2 text-right text-sm font-mono font-bold text-muted-foreground">
                                                {(item.unitPrice * item.receivedQty).toFixed(2)}
                                            </td>

                                            {/* Tax % */}
                                            <td className="py-3 px-2 text-right">
                                                <SearchableSelect
                                                    value={item.taxRate?.toString()}
                                                    onChange={(id, opt) => {
                                                        const n = [...items];
                                                        const rate = Number(id);
                                                        if (!isNaN(rate)) {
                                                            n[index].taxRate = rate;
                                                            // Auto-calc tax amount
                                                            const taxable = (n[index].unitPrice || 0) * (n[index].receivedQty || 0);
                                                            n[index].taxAmount = taxable * (rate / 100);
                                                            setItems(n);
                                                        }
                                                    }}
                                                    onSearch={async (q) => TAX_OPTIONS.filter(o => o.includes(q)).map(o => ({ id: o, label: o + '%' }))}
                                                    onCreate={async (q) => {
                                                        const val = parseFloat(q);
                                                        if (!isNaN(val)) return { id: val.toString(), label: val + '%' };
                                                        return null;
                                                    }}
                                                    options={[
                                                        ...TAX_OPTIONS.map(o => ({ id: o, label: o + '%' })),
                                                        ...(item.taxRate !== undefined && !TAX_OPTIONS.includes(item.taxRate.toString()) ? [{ id: item.taxRate.toString(), label: item.taxRate + '%' }] : [])
                                                    ]}
                                                    placeholder="%"
                                                    variant="ghost"
                                                    className="w-full text-[10px] font-mono text-right font-bold text-foreground placeholder:text-muted/30"
                                                />
                                            </td>

                                            {/* Taxes: CGST/SGST or IGST */}
                                            {taxType === 'INTRA' ? (
                                                <>
                                                    <td className="py-3 px-2 text-right text-sm font-mono text-muted-foreground">
                                                        {((item.taxAmount || 0) / 2).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-sm font-mono text-muted-foreground">
                                                        {((item.taxAmount || 0) / 2).toFixed(2)}
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="py-3 px-2 text-right text-sm font-mono text-muted-foreground">
                                                    {(item.taxAmount || 0).toFixed(2)}
                                                </td>
                                            )}

                                            {/* Total */}
                                            <td className="py-3 px-2 text-right text-sm font-mono font-black text-foreground">
                                                {((item.unitPrice * item.receivedQty) + (item.taxAmount || 0)).toFixed(2)}
                                            </td>

                                            <td className="py-3 pl-2 pr-4 text-right">
                                                {mode === 'direct' && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-2">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={15} className="py-24 text-center">
                                                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                                    <div className="p-6 rounded-full bg-muted border border-border shadow-inner">
                                                        <ScanLine className="h-8 w-8 text-blue-500 opacity-50" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-base font-black text-foreground uppercase tracking-widest">No Manifest Items</p>
                                                        <p className="text-xs font-medium">Scan an invoice or select a Source Order above to begin.</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Summary */}
                        <div className="flex justify-end mt-8">
                            <div className="bg-muted p-8 rounded-3xl border border-border min-w-[360px] shadow-2xl space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Taxable Value</span>
                                        <span className="text-foreground font-black font-mono text-lg tracking-tighter">₹{totalTaxable.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Total Tax</span>
                                        <span className="text-foreground font-black font-mono text-lg tracking-tighter">₹{totalTax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Round Off</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsAutoRound(!isAutoRound)}
                                                className={`text-[8px] font-black px-2 py-0.5 rounded-full border transition-all ${isAutoRound
                                                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                                    : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                                                    }`}
                                            >
                                                AUTO
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            value={roundOff}
                                            onChange={(e) => {
                                                setRoundOff(Number(e.target.value));
                                                setIsAutoRound(false); // Switch to manual on edit
                                            }}
                                            className={`bg-transparent border-b text-right w-24 font-black font-mono text-lg tracking-tighter focus:outline-none transition-all ${isAutoRound ? 'text-muted-foreground border-dashed border-border' : 'text-foreground border-blue-500/30 focus:border-blue-500'}`}
                                            step="0.01"
                                        />
                                    </div>

                                    {/* Calculated Total */}
                                    <div className="pt-6 border-t border-border flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Net Payable</span>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Rounded Total</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-4xl font-black text-foreground font-mono tracking-tighter block">
                                                ₹{netTotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Scanned Comparison */}
                                    {scannedTotal > 0 && (
                                        <div className="mt-6 p-4 bg-background rounded-2xl border border-border space-y-3 shadow-inner">
                                            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
                                                <span className="text-muted-foreground">Scanned Total</span>
                                                <span className="text-foreground font-mono">₹{scannedTotal.toFixed(2)}</span>
                                            </div>
                                            {Math.abs(scannedTotal - netTotal) > 0.01 ? (
                                                <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-rose-500">
                                                    <span>Mismatch</span>
                                                    <span className="font-mono">₹{(netTotal - scannedTotal).toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-emerald-600">
                                                    <span>Verified</span>
                                                    <span className="font-mono">MATCH OK ✓</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </form>
            </main>

            {/* Sticky Footer for Action */}
            <div className="fixed bottom-8 left-0 w-full flex justify-center z-40 pointer-events-none">
                <div className={`bg-background/90 backdrop-blur-2xl border border-border rounded-full p-2.5 pl-8 pr-2.5 flex items-center gap-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] pointer-events-auto transition-all duration-700 ${items.length === 0 ? 'translate-y-24 opacity-0 scale-90' : 'translate-y-0 opacity-100 scale-100'}`}>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <span className="flex items-center gap-2"><Box className="h-4 w-4 text-blue-500" /> {items.reduce((a, c) => a + Number(c.receivedQty), 0)} Units</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                        <span className="text-foreground">{mode === 'po' ? 'PO Tracking' : 'Direct Entry'}</span>
                    </div>
                    {/* Return Button */}
                    <button
                        type="button"
                        onClick={() => setIsReturnDialogOpen(true)}
                        disabled={isSubmitting}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all hover:scale-[1.05] active:scale-[0.95] mr-4 shadow-xl shadow-red-500/10"
                    >
                        <Undo2 className="h-4 w-4" /> Record Return
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || items.length === 0}
                        className="bg-foreground text-background hover:scale-[1.02] active:scale-[0.98] transition-all px-10 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 disabled:opacity-50 shadow-xl shadow-foreground/10"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{params.id ? "Update Entry" : "Finalize Entry"} <ArrowRight className="h-4 w-4" /></>}
                    </button>
                </div>
            </div>

            {/* Return Dialog */}
            <PurchaseReturnDialog
                isOpen={isReturnDialogOpen}
                onClose={() => setIsReturnDialogOpen(false)}
                receiptId={params.id}
                supplierId={supplierId || ''}
                supplierName={supplierName}
                initialItems={items.filter(i => !!i.id).map(i => ({
                    receiptLineId: i.id!,
                    productId: i.productId,
                    productName: i.productName,
                    availableQty: Number(i.receivedQty),
                    returnQty: 0,
                    unitPrice: Number(i.unitPrice),
                    batchId: i.batchId,
                    batchNo: i.batch
                }))}
                onSuccess={() => {
                    toast({ title: "Return Created", description: "Debit Note generated successfully." });
                    setIsReturnDialogOpen(false);
                    // Force refresh key data
                    window.location.reload();
                }}
            />
        </div>
    );
}
