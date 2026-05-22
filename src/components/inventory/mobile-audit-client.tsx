'use client';

import { useState, useRef, useEffect } from 'react';
import {
    QrCode,
    Search,
    Plus,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Calendar,
    Tag,
    Database,
    ChevronRight,
    ArrowLeft,
    Box,
    MousePointerClick,
    X as LucideX,
    Sparkles,
    Camera,
    TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { rapidStockOnboarding } from '@/app/actions/inventory';
import { useRouter } from 'next/navigation';
import { SmartScanner } from './smart-scanner';
import { Dialog as ShadcnDialog, DialogContent as ShadcnDialogContent } from "@/components/ui/dialog";

interface BatchEntry {
    id: string;
    batchNo: string;
    expiryDate: string;
    mrp: string;
    cost: string;
    salePrice: string;
    qty: string;
    systemQty: number; // Current system stock for reference
    uom: string;
    conversionFactor: number;
}

export function MobileAuditClient({ categories, uoms = [] }: { categories: any[], uoms?: any[] }) {
    const router = useRouter();
    const [step, setStep] = useState<'search' | 'details'>('search');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [foundProduct, setFoundProduct] = useState<any>(null);
    const [isNewProduct, setIsNewProduct] = useState(false);

    // Product Details
    const [productName, setProductName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // Batch State
    const [batches, setBatches] = useState<BatchEntry[]>([
        { id: '1', batchNo: '', expiryDate: '', mrp: '', cost: '', salePrice: '', qty: '', systemQty: 0, uom: 'PCS', conversionFactor: 1 }
    ]);
    const [auditMode, setAuditMode] = useState<'absolute' | 'additive'>('additive');
    const [showConfirmOverwrite, setShowConfirmOverwrite] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search for barcode scanners
    useEffect(() => {
        if (step === 'search' && !showCamera) searchInputRef.current?.focus();
    }, [step, showCamera]);

    const handleSearch = async (query: string) => {
        if (!query) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/hms/inventory/lookup?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.product) {
                selectProduct(data.product);
            } else if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            } else {
                setSuggestions([]);
            }
        } catch (err) {
            console.error("Lookup failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCameraScan = (barcode: string) => {
        setSearchQuery(barcode);
        handleSearch(barcode);
        setShowCamera(false);
    };

    const selectProduct = (product: any) => {
        setFoundProduct(product);
        setProductName(product.name);
        setIsNewProduct(false);
        setSuggestions([]);

        // Determine Default Prices: Batch > Master > Meta
        const lastBatch = product.hms_product_batch?.[0];
        const defaultMrp = lastBatch?.mrp || product.price || (product.metadata as any)?.mrp || '';
        const defaultCost = lastBatch?.cost || product.default_cost || (product.metadata as any)?.cost_price || '';
        const defaultSale = lastBatch?.sale_price || product.price || '';
        
        let batchNo = lastBatch?.batch_no || '';
        let expiry = '';
        if (lastBatch?.expiry_date) {
            expiry = new Date(lastBatch.expiry_date).toISOString().split('T')[0];
        }

        setBatches([{
            id: '1',
            batchNo: batchNo,
            expiryDate: expiry,
            mrp: String(defaultMrp || ''),
            cost: String(defaultCost || ''),
            salePrice: String(defaultSale || ''),
            qty: '', // User must still count the physical stock!
            systemQty: Number(lastBatch?.qty_on_hand || 0),
            uom: 'PCS',
            conversionFactor: 1
        }]);

        setStep('details');
        toast.success("Product Loaded from Registry");
    };

    const startForNew = () => {
        setFoundProduct(null);
        setProductName(searchQuery);
        setIsNewProduct(true);
        setSuggestions([]);
        setStep('details');
        toast.info("Registering New Product Node");
    };

    const addBatch = () => {
        setBatches([...batches, {
            id: Math.random().toString(),
            batchNo: '',
            expiryDate: '',
            mrp: '',
            cost: '',
            salePrice: '',
            qty: '',
            systemQty: 0,
            uom: 'PCS',
            conversionFactor: 1
        }]);
    };

    const removeBatch = (id: string) => {
        if (batches.length > 1) {
            setBatches(batches.filter(b => b.id !== id));
        }
    };

    const updateBatch = (id: string, field: keyof BatchEntry, value: string) => {
        setBatches(batches.map(b => {
            if (b.id !== id) return b;

            const update: Partial<BatchEntry> = { [field]: value };

            // World Standard Auto-Sync: If MRP is typed, Sale Price matches it automatically
            if (field === 'mrp') {
                update.salePrice = value;
            }

            // Sync Conversion Factor if UOM changes
            if (field === 'uom') {
                const selectedUom = uoms.find(u => u.name.toUpperCase() === value.toUpperCase());
                if (selectedUom) {
                    update.conversionFactor = Number(selectedUom.ratio) || 1;
                } else {
                    // Fallback to old hardcoded factors if UOM Name matches known standard but isn't in DB
                    const factors: Record<string, number> = { 'STRIP': 10, 'BOX': 50, 'PACK': 15, 'PCS': 1, 'UNIT': 1 };
                    update.conversionFactor = factors[value.toUpperCase().replace(/S$/, '')] || 1;
                }
            }

            return { ...b, ...update };
        }));
    };

    const handleSync = async () => {
        if (isNewProduct && !productName.trim()) {
            toast.error("Please enter a product name");
            return;
        }

        // WORLD STANDARD SAFETY: If in Absolute mode, require double-confirmation
        if (auditMode === 'absolute' && !showConfirmOverwrite) {
            setShowConfirmOverwrite(true);
            return;
        }

        // ... existing logic ...
        const processingBatches = batches.filter(b => b.qty !== "");
        
        if (processingBatches.length === 0) {
            toast.error("Please enter a quantity to sync stock.");
            return;
        }

        setSubmitting(true);
        try {
            const result = await rapidStockOnboarding({
                barcode: searchQuery.trim(),
                productId: foundProduct?.id,
                productName: productName.trim(),
                categoryId: selectedCategory,
                batches: processingBatches.map(b => {
                    const finalBatchNo = b.batchNo.trim() || `AUDIT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
                    
                    return {
                        batchNo: finalBatchNo,
                        expiryDate: b.expiryDate,
                        mrp: parseFloat(b.mrp) || 0,
                        cost: parseFloat(b.cost) || 0,
                        salePrice: parseFloat(b.salePrice || b.mrp) || 0,
                        qty: auditMode === 'absolute' 
                            ? (parseFloat(b.qty) || 0) 
                            : (b.systemQty + (parseFloat(b.qty) || 0)),
                        uom: b.uom,
                        conversionFactor: b.conversionFactor
                    };
                })
            }) as any;

            if ('success' in result) {
                toast.success("Audit Recorded Successfully!");
                setStep('search');
                setSearchQuery('');
                setSuggestions([]);
                setBatches([{ id: '1', batchNo: '', expiryDate: '', mrp: '', cost: '', salePrice: '', qty: '', systemQty: 0, uom: 'PCS', conversionFactor: 1 }]);
                setIsNewProduct(false);
                setShowConfirmOverwrite(false);
            } else {
                toast.error(result.error || "Sync failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Internal Connection Error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-md mx-auto h-screen flex flex-col bg-slate-50 dark:bg-black font-sans">
            {/* Minimal Mobile Header */}
            <header className="p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Box className="text-white h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Audit Terminal</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Instant Stock Sync v3.1</p>
                    </div>
                </div>
                {step === 'details' && (
                    <Button variant="ghost" size="icon" onClick={() => setStep('search')} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                <AnimatePresence mode="wait">
                    {step === 'search' ? (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6 pt-6"
                        >
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <Input
                                            ref={searchInputRef}
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                handleSearch(e.target.value);
                                            }}
                                            placeholder="SKU / Name..."
                                            className="h-16 pl-12 rounded-2xl border-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-lg font-bold focus:border-indigo-600 focus:ring-0 transition-all shadow-xl"
                                        />
                                        {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>}
                                    </div>
                                    <Button
                                        onClick={() => setShowCamera(true)}
                                        className="h-16 w-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 shadow-xl transition-transform hover:scale-105"
                                    >
                                        <Camera className="h-6 w-6" />
                                        <span className="text-[8px] font-black uppercase">Scan</span>
                                    </Button>
                                </div>

                                {/* Dynamic Search Results */}
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {suggestions.length > 0 ? (
                                            suggestions.map((p, i) => (
                                                <motion.button
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    key={p.id}
                                                    onClick={() => selectProduct(p)}
                                                    className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-left group active:bg-indigo-50 active:border-indigo-200 transition-all shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-400 group-active:bg-indigo-600 group-active:text-white transition-all">
                                                            {p.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900 dark:text-white text-sm leading-none mb-1">{p.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">{p.sku}</p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-slate-300 group-active:text-indigo-600" />
                                                </motion.button>
                                            ))
                                        ) : searchQuery.length > 2 && !loading ? (
                                            <motion.button
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                onClick={startForNew}
                                                className="w-full bg-indigo-50 border-2 border-dashed border-indigo-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-2"
                                            >
                                                <Sparkles className="h-8 w-8 text-indigo-500" />
                                                <div>
                                                    <p className="font-black text-indigo-900 text-sm">Product Not in Registry</p>
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Tap to onboard "{searchQuery}"</p>
                                                </div>
                                            </motion.button>
                                        ) : null}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {!searchQuery && (
                                <div className="text-center space-y-6 pt-10">
                                    <div className="w-24 h-24 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/10 mb-4 animate-pulse">
                                        <QrCode className="h-10 w-10 text-slate-200" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Fast Audit Standby Mode</p>
                                    
                                    <div className="pt-8 space-y-4">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => router.push('/hms/inventory/reports/ledger')} 
                                            className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white text-slate-900 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 transition-all"
                                        >
                                            <Database className="h-4 w-4 text-indigo-500" />
                                            View Audit History (Register)
                                        </Button>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight italic">Administrators can view/edit every scan in the Movement Register.</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            {/* Product Branding */}
                            <div className={`p-5 rounded-3xl border-2 ${isNewProduct ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-800 shadow-xl shadow-indigo-500/5'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isNewProduct ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {isNewProduct ? "Onboarding" : "Active Audit Point"}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{searchQuery}</span>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Name</p>
                                        <input
                                            value={productName}
                                            onChange={(e) => setProductName(e.target.value)}
                                            placeholder="Enter generic or brand name..."
                                            className="w-full bg-transparent border-none p-0 text-xl font-black text-slate-900 dark:text-white focus:ring-0 placeholder:text-slate-300"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Category</p>
                                        <select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="w-full h-11 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-sm font-bold indent-2 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                                        >
                                            <option value="">Uncategorized</option>
                                            {Array.isArray(categories) && categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Audit Mode Selector - WORLD STANDARD */}
                            <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                <button
                                    onClick={() => setAuditMode('absolute')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'absolute' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600' : 'text-slate-400'}`}
                                >
                                    Overwrite Stock
                                </button>
                                <button
                                    onClick={() => setAuditMode('additive')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'additive' ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                                >
                                    Add to Stock
                                </button>
                            </div>

                            {/* Batch Entry List */}
                            <div className="space-y-4 pb-20">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        Inventory Nodes
                                        <span className="h-5 px-1.5 bg-slate-100 rounded text-[10px] text-slate-500">{batches.length}</span>
                                    </h3>
                                    <Button size="sm" onClick={addBatch} className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 h-8 text-[10px] uppercase font-black tracking-widest shadow-sm">
                                        <Plus className="h-3 w-3 mr-1" /> New Batch
                                    </Button>
                                </div>

                                {batches.map((batch, index) => (
                                    <motion.div
                                        layout
                                        key={batch.id}
                                        className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm relative group"
                                    >
                                        {batches.length > 1 && (
                                            <button onClick={() => removeBatch(batch.id)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 z-10 transition-transform hover:scale-110">
                                                <LucideX className="h-3 w-3" />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <Tag className="h-2.5 w-2.5 text-slate-400" /> Lot / Batch #
                                                    </p>
                                                    <Input
                                                        value={batch.batchNo}
                                                        onChange={(e) => updateBatch(batch.id, 'batchNo', e.target.value)}
                                                        placeholder="e.g. BT-992"
                                                        className="h-10 rounded-xl font-bold uppercase tracking-tighter"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <Calendar className="h-2.5 w-2.5" /> Expiry
                                                    </p>
                                                    <Input
                                                        type="date"
                                                        value={batch.expiryDate}
                                                        onChange={(e) => updateBatch(batch.id, 'expiryDate', e.target.value)}
                                                        className="h-10 rounded-xl font-bold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry Unit (UOM)</p>
                                                <select
                                                    value={batch.uom}
                                                    onChange={(e) => updateBatch(batch.id, 'uom', e.target.value)}
                                                    className="w-full h-10 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest px-2 outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                                >
                                                    {uoms.length === 0 ? (
                                                        <>
                                                            <option value="PCS">PCS (Unit)</option>
                                                            <option value="STRIP">STRIP (10)</option>
                                                            <option value="BOX">BOX (50)</option>
                                                        </>
                                                    ) : (
                                                        Array.isArray(uoms) && uoms.map(u => (
                                                            <option key={u.id} value={u.name}>
                                                                {u.name.toUpperCase()} ({u.ratio})
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cost Per UOM</p>
                                                <Input
                                                    type="number"
                                                    value={batch.cost}
                                                    onChange={(e) => updateBatch(batch.id, 'cost', e.target.value)}
                                                    placeholder="Cost..."
                                                    className="h-10 rounded-xl font-bold font-mono text-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40"
                                                />
                                            </div>

                                            <div className="space-y-1 bg-indigo-50/50 dark:bg-indigo-900/10 p-2 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                                    <TrendingUp className="h-2.5 w-2.5" /> MRP (100%)
                                                </p>
                                                <Input
                                                    type="number"
                                                    value={batch.mrp}
                                                    onChange={(e) => updateBatch(batch.id, 'mrp', e.target.value)}
                                                    placeholder="0.00"
                                                    className="h-10 bg-white dark:bg-zinc-950 rounded-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50"
                                                />
                                            </div>

                                            <div className="space-y-1 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Price</p>
                                                <Input
                                                    type="number"
                                                    value={batch.salePrice}
                                                    onChange={(e) => updateBatch(batch.id, 'salePrice', e.target.value)}
                                                    placeholder="0.00"
                                                    className="h-10 bg-white dark:bg-zinc-950 rounded-xl font-bold font-mono text-slate-900 dark:text-zinc-100"
                                                />
                                            </div>

                                            <div className="col-span-2 space-y-1">
                                                <div className="flex justify-between items-end mb-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                        {auditMode === 'absolute' ? 'Total Actual Stock (Found)' : 'New Quantity to Add'}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        System: <span className="font-mono text-slate-900 dark:text-white">{batch.systemQty}</span>
                                                    </span>
                                                </div>
                                                <div className="relative flex items-center gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        onClick={() => {
                                                            const currentVal = parseFloat(batch.qty) || 0;
                                                            updateBatch(batch.id, 'qty', (currentVal - 1).toString());
                                                        }}
                                                        className="h-12 w-12 rounded-xl border-slate-200 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-black hover:bg-slate-50 transition-all active:scale-90 shrink-0 shadow-sm"
                                                    >
                                                        -
                                                    </Button>
                                                    <div className="relative flex-1">
                                                        <Input
                                                            type="number"
                                                            value={batch.qty}
                                                            onChange={(e) => updateBatch(batch.id, 'qty', e.target.value)}
                                                            placeholder="0"
                                                            className={`h-12 rounded-xl font-black shadow-sm text-lg text-center ${auditMode === 'absolute' ? 'text-indigo-600 bg-indigo-50/50 border-indigo-100' : 'text-emerald-600 bg-emerald-50/50 border-emerald-100'}`}
                                                        />
                                                        {auditMode === 'additive' && batch.qty && (
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase pointer-events-none">
                                                                Result: {batch.systemQty + (parseFloat(batch.qty) || 0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        onClick={() => {
                                                            const currentVal = parseFloat(batch.qty) || 0;
                                                            updateBatch(batch.id, 'qty', (currentVal + 1).toString());
                                                        }}
                                                        className="h-12 w-12 rounded-xl border-slate-200 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-black hover:bg-slate-50 transition-all active:scale-90 shrink-0 shadow-sm"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Absolute Mode Confirmation Modal */}
            <ShadcnDialog open={showConfirmOverwrite} onOpenChange={setShowConfirmOverwrite}>
                <ShadcnDialogContent className="max-w-[400px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-slate-950 p-8 text-white">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="h-16 w-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 mb-2">
                                <AlertCircle className="h-8 w-8 text-rose-500" />
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Overwrite Warning</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                You are about to <span className="text-white">FORCE OVERWRITE</span> the system stock. 
                                This will ignore existing records and set reality to exactly your count.
                            </p>
                        </div>
                    </div>
                    <div className="p-6 bg-white dark:bg-zinc-900 flex flex-col gap-3">
                        <Button 
                            onClick={() => {
                                setShowConfirmOverwrite(false);
                                handleSync();
                            }}
                            className="h-14 bg-slate-900 dark:bg-zinc-800 hover:bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all"
                        >
                            Proceed with Overwrite
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => setShowConfirmOverwrite(false)}
                            className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        >
                            Wait, Take me Back
                        </Button>
                    </div>
                </ShadcnDialogContent>
            </ShadcnDialog>

            {/* Camera Overlay */}
            <SmartScanner
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onScan={handleCameraScan}
            />

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-slate-200 dark:border-zinc-800 z-50">
                <div className="max-w-md mx-auto">
                    {step === 'details' ? (
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleSync}
                                disabled={submitting}
                                className="w-full h-16 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95"
                            >
                                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <> <CheckCircle2 className="h-6 w-6" /> Complete & Sync Stock </>}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setStep('search')}
                                className="h-10 text-[10px] uppercase font-black tracking-widest text-slate-400"
                            >
                                Back to Scanner
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 p-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Terminal Node Active • Point Scanner to Start</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
