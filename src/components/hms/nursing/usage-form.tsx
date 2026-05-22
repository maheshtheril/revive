'use client'

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { consumeStockBulk, ConsumptionItem, confirmNursingConsumption } from "@/app/actions/nursing-inventory"
import { getProductAvailableUOMs } from "@/app/actions/product-uom"
import { getConsumptionHistory } from "@/app/actions/nursing-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { getProductsPremium } from "@/app/actions/inventory"
import { 
    Loader2, Check, PackageMinus, Plus, Trash2, ShoppingCart, 
    Info, ScanLine, Clock, X, Search, IndianRupee, 
    ChevronDown, Edit, ArrowRight, Activity, Beaker
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AnimatePresence, motion } from "framer-motion"

interface UsageFormProps {
    patientId: string
    encounterId: string
    patientName: string
    onCancel?: () => void
    onSuccess?: () => void
    isModal?: boolean
}

type CartItem = ConsumptionItem & {
    productName: string
    uom: string
    stock: number
    price: number
    id: string 
}

export function UsageForm({ patientId, encounterId, patientName, onCancel, onSuccess, isModal = false }: UsageFormProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)

    // [ELITE] High-Speed Search Logic
    useEffect(() => {
        if (searchQuery.trim().length === 0) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const fetchResults = async () => {
            setIsSearching(true);
            setShowResults(true);
            try {
                const res = await getProductsPremium(searchQuery, 1);
                if (res.success && res.data) {
                    setSearchResults(res.data.map((p: any) => ({
                        id: p.id,
                        label: p.name,
                        subLabel: `S: ${p.totalStock} ${p.uom} | ₹${Number(p.price || 0).toFixed(2)}`,
                        ...p
                    })));
                } else {
                    setSearchResults([]);
                }
            } catch (e) {
                console.error("Search failed:", e);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isConfirming, setIsConfirming] = useState<string | null>(null)

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([])

    // Current Item State (Transient)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [quantity, setQuantity] = useState(1)
    const [selectedUOM, setSelectedUOM] = useState<string>("")
    const [availableUOMs, setAvailableUOMs] = useState<any[]>([])
    const [notes, setNotes] = useState("")
    const [itemPrice, setItemPrice] = useState<number>(0)
    const [selectedBatchId, setSelectedBatchId] = useState<string>("")
    const [availableBatches, setAvailableBatches] = useState<any[]>([])
    const [isBatchLoading, setIsBatchLoading] = useState(false)

    const [history, setHistory] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    const qtyInputRef = useRef<HTMLInputElement>(null)
    const priceInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadHistory()
    }, [encounterId])

    async function loadHistory() {
        setLoadingHistory(true)
        const res = await getConsumptionHistory(encounterId)
        if (res.data) {
            setHistory(res.data)
        }
        setLoadingHistory(false)
    }

    const addItem = () => {
        if (!selectedProduct) return;
        if (quantity <= 0) {
            toast({
                title: "Invalid Quantity",
                description: "Quantity must be greater than 0",
                variant: "destructive"
            })
            return
        }

        const newItem: CartItem = {
            id: Math.random().toString(36).substr(2, 9),
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            batchId: selectedBatchId || undefined,
            quantity: Number(quantity),
            uom: selectedUOM || selectedProduct.uom,
            stock: selectedProduct.totalStock,
            price: Number(itemPrice) || Number(selectedProduct.price || 0),
            notes: notes
        }

        setCart(prev => [...prev, newItem])

        // Reset Inputs
        setSelectedProduct(null)
        setQuantity(1)
        setItemPrice(0)
        setSelectedUOM("")
        setAvailableUOMs([])
        setSelectedBatchId("")
        setAvailableBatches([])
        setNotes("")
        setSearchQuery("")
        toast({
            description: "Item added to session list",
        })
    }

    const removeItem = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (cart.length === 0) {
            toast({
                title: "Cart Empty",
                description: "Please add at least one item",
                variant: "destructive"
            })
            return
        }

        setIsSubmitting(true)
        try {
            const result = await consumeStockBulk({
                items: cart.map(({ productId, quantity, uom, notes, price, batchId }) => ({ 
                    productId, 
                    quantity, 
                    uom, 
                    notes, 
                    price,
                    batchId 
                })),
                patientId,
                encounterId
            })

            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive"
                })
                setIsSubmitting(false)
            } else {
                toast({
                    title: "Charges Posted",
                    description: "Stock consumed and charges added to billing.",
                })

                await loadHistory()
                setCart([])
                setIsSubmitting(false)
                if (onSuccess && !isModal) onSuccess()
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive"
            })
            setIsSubmitting(false)
        }
    }

    const selectItem = async (item: any) => {
        setSelectedProduct(item);
        setItemPrice(Number(item.price || 0));
        setSearchQuery('');
        setShowResults(false);
        setIsBatchLoading(true);
        
        try {
            const res = await getProductAvailableUOMs(item.id);
            if (res.success && res.data) {
                setAvailableUOMs(res.data);
                setSelectedUOM(res.data[0]?.uom || item.uom || "Unit");
            } else {
                setAvailableUOMs([{ uom: item.uom || "Unit", factor: 1 }]);
                setSelectedUOM(item.uom || "Unit");
            }
            
            const { getProductBatches } = await import("@/app/actions/inventory");
            const batches = await getProductBatches(item.id);
            // [CLINICAL INTELLIGENCE] Sort by expiry (FEFO) and filter non-zero stock
            const validBatches = (batches as any[])
                .filter(b => Number(b.qty_on_hand) > 0)
                .sort((a, b) => {
                    if (!a.expiry_date) return 1;
                    if (!b.expiry_date) return -1;
                    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                });

            setAvailableBatches(validBatches);
            
            if (validBatches.length > 0) {
                // Auto-select the first valid FEFO batch
                const bestBatch = validBatches[0];
                setSelectedBatchId(bestBatch.id);
                if (Number(bestBatch.sale_price) > 0) {
                    setItemPrice(Number(bestBatch.sale_price));
                }
            } else {
                setSelectedBatchId("");
            }
        } catch (err) {
            console.error("Failed to load item details:", err);
        } finally {
            setIsBatchLoading(false);
            setTimeout(() => {
                qtyInputRef.current?.focus();
                qtyInputRef.current?.select();
            }, 100);
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Tabs defaultValue="new" className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-3 flex items-center justify-between z-10">
                    <TabsList className="grid w-[400px] grid-cols-2 h-10 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <TabsTrigger value="new" className="rounded-md font-bold text-xs uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">New Entry</TabsTrigger>
                        <TabsTrigger value="history" className="rounded-md font-bold text-xs uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-600 border-blue-100 font-bold text-[10px] uppercase">
                            Patient: {patientName}
                        </Badge>
                        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="h-5 w-5" /></button>
                    </div>
                </div>

                <TabsContent value="new" className="flex-1 flex flex-col overflow-hidden mt-0">
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT: Entry Form */}
                        <div className="w-[450px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search & Select Item</Label>
                                <Command shouldFilter={false} className="overflow-visible bg-transparent">
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                            <Search className="h-5 w-5" />
                                        </div>
                                        <CommandInput 
                                            placeholder="Medication or service..."
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                            className="w-full h-12 pl-12 pr-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none font-bold text-sm transition-all shadow-sm"
                                        />
                                        {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>}
                                    </div>

                                    {/* [WORLD CLASS] Inline Search Results with Keyboard Support */}
                                    <AnimatePresence>
                                        {showResults && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="bg-white border-2 border-indigo-100 rounded-2xl shadow-xl overflow-hidden z-20 absolute left-6 right-6 mt-1"
                                            >
                                                <CommandList className="max-h-[250px] overflow-y-auto">
                                                    {searchResults.length === 0 && !isSearching ? (
                                                        <CommandEmpty className="p-6 text-center text-slate-400 text-xs font-bold uppercase italic">No items found</CommandEmpty>
                                                    ) : (
                                                        <CommandGroup>
                                                            {searchResults.map((item) => (
                                                                <CommandItem 
                                                                    key={item.id}
                                                                    value={item.id}
                                                                    onSelect={() => selectItem(item)}
                                                                    className="px-6 py-3 aria-selected:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                                                                >
                                                                    <div className="flex-1">
                                                                        <div className="font-black text-[11px] uppercase text-slate-900 group-aria-selected:text-indigo-600 transition-colors">{item.label}</div>
                                                                        <div className="text-[9px] text-slate-500 font-bold mt-0.5 uppercase tracking-tighter">{item.uom} • Stock: {item.totalStock}</div>
                                                                    </div>
                                                                    <ArrowRight className="h-3 w-3 text-slate-200 group-aria-selected:text-indigo-400" />
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}
                                                </CommandList>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Command>
                            </div>

                            {selectedProduct && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md"><Beaker className="h-4 w-4" /></div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black uppercase text-indigo-900 truncate max-w-[200px]">{selectedProduct.name}</div>
                                                <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">{selectedProduct.uom}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedProduct(null)} className="text-indigo-300 hover:text-indigo-600 p-1"><X className="h-3 w-3" /></button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</Label>
                                            <Input 
                                                ref={qtyInputRef}
                                                type="number"
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.valueAsNumber)}
                                                className="h-10 border-slate-200 focus:ring-indigo-500 rounded-lg font-black text-center text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate (₹)</Label>
                                            <Input 
                                                type="number"
                                                value={itemPrice}
                                                onChange={(e) => setItemPrice(e.target.valueAsNumber)}
                                                className="h-10 border-slate-200 focus:ring-emerald-500 rounded-lg font-black text-center text-sm text-emerald-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between ml-1">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inventory Source (Batch)</Label>
                                            {availableBatches.length > 1 && (
                                                <Badge variant="outline" className="h-4 text-[8px] px-1 bg-indigo-50 text-indigo-600 border-indigo-100 font-black uppercase">
                                                    {availableBatches.length} Available
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        {isBatchLoading ? (
                                            <div className="h-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
                                                <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                                            </div>
                                        ) : availableBatches.length === 0 ? (
                                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                                                <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><PackageMinus className="h-4 w-4" /></div>
                                                <div>
                                                    <div className="text-[10px] font-black text-red-900 uppercase">Out of Stock</div>
                                                    <div className="text-[8px] font-bold text-red-400 uppercase tracking-tight">No active batches found in warehouse</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {/* [WORLD CLASS] Interactive Batch Picker List */}
                                                <div className="grid grid-cols-1 gap-2">
                                                    {availableBatches.slice(0, 3).map((b, idx) => {
                                                        const isSelected = selectedBatchId === b.id;
                                                        const isExpired = b.expiry_date && new Date(b.expiry_date) < new Date();
                                                        const daysToExpiry = b.expiry_date ? Math.ceil((new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 999;
                                                        
                                                        return (
                                                            <button 
                                                                key={b.id}
                                                                onClick={() => {
                                                                    setSelectedBatchId(b.id);
                                                                    if (Number(b.sale_price) > 0) setItemPrice(Number(b.sale_price));
                                                                }}
                                                                className={cn(
                                                                    "p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden group",
                                                                    isSelected 
                                                                        ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/10" 
                                                                        : "border-slate-100 bg-white hover:border-slate-200"
                                                                )}
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={cn(
                                                                                "text-[10px] font-black uppercase tracking-tight truncate",
                                                                                isSelected ? "text-indigo-900" : "text-slate-700"
                                                                            )}>
                                                                                {b.batch_no}
                                                                            </span>
                                                                            {idx === 0 && (
                                                                                <Badge className="bg-emerald-500 text-[8px] h-3.5 px-1 font-black uppercase">FEFO</Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Stock: {Number(b.qty_on_hand)}</span>
                                                                            {b.expiry_date && (
                                                                                <span className={cn(
                                                                                    "text-[8px] font-bold uppercase",
                                                                                    daysToExpiry < 30 ? "text-red-500" : "text-slate-400"
                                                                                )}>
                                                                                    Exp: {format(new Date(b.expiry_date), 'MMM yy')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                                                                </div>
                                                                
                                                                {/* Price context indicator */}
                                                                {Number(b.sale_price) > 0 && (
                                                                    <div className="absolute bottom-1 right-2 text-[8px] font-black text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        RATE: ₹{Number(b.sale_price).toFixed(2)}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                    
                                                    {availableBatches.length > 3 && (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full h-8 text-[9px] font-black uppercase tracking-widest border-dashed">
                                                                    View all {availableBatches.length} batches...
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[300px] p-2 bg-white rounded-2xl shadow-2xl border-indigo-100">
                                                                <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
                                                                    {availableBatches.map(b => (
                                                                        <button 
                                                                            key={b.id}
                                                                            onClick={() => {
                                                                                setSelectedBatchId(b.id);
                                                                                if (Number(b.sale_price) > 0) setItemPrice(Number(b.sale_price));
                                                                            }}
                                                                            className="w-full p-2 hover:bg-slate-50 rounded-lg text-left flex justify-between items-center group transition-colors"
                                                                        >
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-slate-900 group-hover:text-indigo-600">{b.batch_no}</div>
                                                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Stock: {Number(b.qty_on_hand)} • Exp: {b.expiry_date ? format(new Date(b.expiry_date), 'dd/MM/yy') : 'N/A'}</div>
                                                                            </div>
                                                                            <ArrowRight className="h-3 w-3 text-slate-200 group-hover:text-indigo-400" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Notes</Label>
                                        <textarea 
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Usage indication..."
                                            className="w-full h-16 p-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg font-medium text-[10px] outline-none resize-none transition-all"
                                        />
                                    </div>

                                    <Button onClick={addItem} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-500/10 group transition-all active:scale-95">
                                        Add to session <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </motion.div>
                            )}
                        </div>

                        {/* RIGHT: Session Cart & Submission */}
                        <div className="flex-1 bg-slate-50/50 p-8 flex flex-col gap-6 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 italic">Consumption Queue</h3>
                                <Badge className="bg-slate-900 text-white font-black px-3 py-1 rounded-lg">{cart.length} ITEMS</Badge>
                            </div>

                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-y-auto custom-scrollbar flex flex-col">
                                <AnimatePresence>
                                    {cart.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50 italic">
                                            <ShoppingCart className="h-16 w-16 mb-4" />
                                            <p className="text-xs font-black uppercase tracking-widest">Queue is currently empty</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {cart.map((item) => (
                                                <motion.div 
                                                    key={item.id} 
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm"><PackageMinus className="h-5 w-5" /></div>
                                                        <div>
                                                            <div className="text-xs font-black uppercase text-slate-900">{item.productName}</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} {item.uom} @ ₹{item.price.toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-sm font-black text-slate-900 font-mono">₹{(item.price * item.quantity).toFixed(2)}</div>
                                                        <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 shadow-xl">
                                <div className="flex justify-between items-center mb-6 px-2">
                                    <div className="text-xs font-black uppercase text-slate-400">Total Charges</div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</div>
                                </div>
                                <Button 
                                    disabled={isSubmitting || cart.length === 0}
                                    onClick={handleSubmit}
                                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-[0.3em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-4"
                                >
                                    {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Check className="h-6 w-6" /> Confirm & Post Charges</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 overflow-y-auto p-8 bg-white mt-0">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center p-20 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Syncing Clinical History...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center p-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Beaker className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">No recorded usage found for this visit.</p>
                            </div>
                        ) : (
                            history.map((event, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black uppercase">{(event.nurseName || 'U').charAt(0)}</div>
                                            <span className="text-xs font-black uppercase text-slate-700">{event.nurseName || 'Nurse'}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">{event.timestamp ? format(new Date(event.timestamp), 'MMM d, HH:mm') : '-'}</span>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {event.items.map((item: any, j: number) => (
                                            <div key={j} className="flex justify-between items-center text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs uppercase text-slate-900">{item.productName}</span>
                                                    <span className="text-[10px] font-bold text-indigo-500 italic uppercase">Charge Confirmed</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black font-mono">₹{Number(item.price * item.quantity).toFixed(2)}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold">{item.quantity} {item.uom}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={cn(
                                        "px-6 py-3 border-t text-[10px] font-black uppercase tracking-widest flex justify-between items-center",
                                        event.status === 'confirmed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {event.status === 'confirmed' ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3 animate-pulse" />}
                                            {event.status}
                                        </div>
                                        {event.status !== 'confirmed' && (
                                            <button 
                                                disabled={!!isConfirming}
                                                onClick={async () => {
                                                    setIsConfirming(event.id);
                                                    const res = await confirmNursingConsumption(encounterId, event.moveIds);
                                                    if (res.success) {
                                                        toast({ title: "Clinical Clearance Complete", description: "Charge posted to final billing." });
                                                        loadHistory();
                                                    } else {
                                                        toast({ 
                                                            title: "Confirmation Failed", 
                                                            description: res.error || "Could not confirm items.", 
                                                            variant: "destructive" 
                                                        });
                                                    }
                                                    setIsConfirming(null);
                                                }}
                                                className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
                                            >
                                                Confirm Now
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
