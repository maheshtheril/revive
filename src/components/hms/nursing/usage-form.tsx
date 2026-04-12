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
import { Loader2, Check, PackageMinus, Plus, Trash2, ShoppingCart, Info, ScanLine, Clock, X, Search, IndianRupee } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Edit } from "lucide-react"
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
    id: string // Temporary ID for UI handling
}

export function UsageForm({ patientId, encounterId, patientName, onCancel, onSuccess, isModal = false }: UsageFormProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // [WORLD CLASS] Search Logic for High-Speed Consumption Entry
    useEffect(() => {
        const fetchResults = async () => {
            // Fetch if searching or if the dropdown is just opened
            if (!isSearchOpen && searchQuery.length === 0) return;
            
            setIsSearching(true);
            try {
                const res = await getProductsPremium(searchQuery, 1);
                if (res.success && res.data) {
                    setSearchResults(res.data.map((p: any) => ({
                        id: p.id,
                        label: p.name,
                        subLabel: `S: ${p.totalStock} ${p.uom} | ₹${Number(p.price || 0).toFixed(2)}`,
                        ...p
                    })));
                }
            } catch (e) {
                console.error("Search failed:", e);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchResults, searchQuery.length === 0 ? 0 : 200);
        return () => clearTimeout(timer);
    }, [searchQuery, isSearchOpen]);

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

    const [history, setHistory] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // REFS for High-Speed Keyboard Navigation
    const qtyInputRef = useRef<HTMLInputElement>(null)
    const priceInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadHistory()
    }, [])

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
            quantity: Number(quantity),
            uom: selectedUOM || selectedProduct.uom,
            stock: selectedProduct.totalStock,
            price: Number(itemPrice) || Number(selectedProduct.price || 0),
            notes: notes
        }

        setCart(prev => [...prev, newItem])

        // Reset Inputs (Keep same product might be useful but following usual pattern)
        setSelectedProduct(null)
        setQuantity(1)
        setItemPrice(0)
        setSelectedUOM("")
        setAvailableUOMs([])
        setNotes("")
        toast({
            description: "Item added to session list",
        })
    }

    // [ELITE] Focus Bridging for Rapid Entry
    const handleAddWithFocus = () => {
        addItem();
        // Return focus to search for next item? Usually yes in high-speed workflows.
        // Or if user wants to keep adding same item, then don't reset selectedProduct.
        // But per current addItem logic, it resets selectedProduct.
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
                items: cart.map(({ productId, quantity, uom, notes, price }) => ({ productId, quantity, uom, notes, price })),
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
                    title: "Charges Added to Bill",
                    description: "Inventory consumed and charges posted to draft invoice.",
                })

                await loadHistory()
                setCart([])

                setTimeout(() => {
                    setIsSubmitting(false)
                    if (onSuccess) {
                        onSuccess()
                    } else {
                        router.push('/hms/nursing/dashboard')
                    }
                }, 1500)
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

    const CartList = () => (
        <div className="space-y-2 mb-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex-1 min-h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
            <AnimatePresence>
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="h-24 w-24 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl opacity-20">
                            <ShoppingCart className="h-12 w-12" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] italic">Consumption Queue Empty</p>
                        <p className="text-[10px] mt-2 font-bold opacity-60">Add items from the terminal above to initiate clinical charges</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <div className="hidden lg:grid grid-cols-12 gap-6 px-6 py-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                            <div className="col-span-5 text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Medical Description</div>
                            <div className="col-span-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Volume / Qty</div>
                            <div className="col-span-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Clinical Rate</div>
                            <div className="col-span-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Net Charge</div>
                            <div className="col-span-1"></div>
                        </div>
                        {cart.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 pl-6 rounded-2xl shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center group transition-all hover:bg-slate-50 dark:hover:bg-slate-800/10 hover:shadow-md"
                            >
                                <div className="lg:col-span-5 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 transition-transform group-hover:scale-110">
                                        <PackageMinus className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tighter truncate">{item.productName}</h4>
                                        {item.notes ? (
                                            <p className="text-[10px] font-bold italic text-indigo-500 truncate mt-0.5">Clinical Note: {item.notes}</p>
                                        ) : (
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Inventory Verified</p>
                                        )}
                                    </div>
                                </div>
                                <div className="lg:col-span-2 flex justify-center">
                                    <Badge variant="outline" className="px-4 py-1.5 rounded-full border-2 border-indigo-100 bg-indigo-50/30 text-indigo-700 font-black text-[10px] uppercase tracking-tighter">
                                        {item.quantity} {item.uom}
                                    </Badge>
                                </div>
                                <div className="lg:col-span-2 text-right">
                                    <span className="text-[11px] font-black text-slate-400 font-mono">₹{item.price.toFixed(2)}</span>
                                </div>
                                <div className="lg:col-span-2 text-right">
                                    <span className="text-sm font-black text-slate-900 dark:text-white font-mono">₹{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                                <div className="lg:col-span-1 flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    )

    const HistoryList = () => (
        <div className="space-y-4 h-[400px] overflow-y-auto px-1">
            {loadingHistory ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : history.length === 0 ? (
                <div className="text-center p-8 text-slate-400">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No usage history for this encounter yet.</p>
                </div>
            ) : (
                <>
                    {history.some(e => (e.status === 'Pending Confirmation' || e.status === 'draft')) && (
                        <button
                            onClick={async () => {
                                if (confirm("Confirm all pending consumption for this visit? This will instantly unlock the billing process.")) {
                                    const allPendingIds = history.filter(e => e.status === 'Pending Confirmation' || e.status === 'draft').flatMap(e => e.moveIds);
                                    const res = await confirmNursingConsumption(encounterId, allPendingIds);
                                    if (res.success) {
                                        toast({ title: "Clinical Clearance Complete", description: "All items confirmed. Billing terminal unlocked." });
                                        loadHistory();
                                        router.refresh();
                                    } else {
                                        toast({ title: "Operation Failed", description: res.error as string || "Could not confirm items", variant: "destructive" });
                                    }
                                }
                            }}
                            className="w-full mb-4 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                            <Check className="h-5 w-5" /> Confirm All Pending Charges
                        </button>
                    )}
                    {history.map((event, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                        {(event.nurseName || 'U').charAt(0)}
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{event.nurseName || 'Nurse'}</span>
                                </div>
                                <span className="font-mono text-slate-400 uppercase">
                                    {event.timestamp ? format(new Date(event.timestamp), 'MMM d, HH:mm') : '-'}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {event.items.map((item: any, j: number) => (
                                    <div key={j} className="flex justify-between items-center px-4 py-2 text-sm">
                                        <span className="font-medium text-slate-600 dark:text-slate-300">{item.productName}</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                                                {item.quantity} {item.uom}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">₹{Number(item.price || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={cn(
                                "px-4 py-2 border-t text-[10px] font-bold flex justify-between items-center",
                                (event.status === 'Pending Confirmation' || event.status === 'draft')
                                    ? "bg-amber-50/50 border-amber-100/50 text-amber-700"
                                    : "bg-emerald-50/50 border-emerald-100/50 text-emerald-700"
                            )}>
                                <div className="flex items-center gap-2">
                                    {(event.status === 'Pending Confirmation' || event.status === 'draft') ?
                                        <Clock className="h-3 w-3 animate-pulse" /> :
                                        <Check className="h-3 w-3 text-emerald-500" />
                                    }
                                    <span className="uppercase tracking-widest">{event.status}</span>
                                </div>

                                {(event.status === 'Pending Confirmation' || event.status === 'draft') && (
                                    <button
                                        disabled={!!isConfirming}
                                        onClick={async () => {
                                            try {
                                                setIsConfirming(event.id);
                                                const res = await confirmNursingConsumption(encounterId, event.moveIds);
                                                if (res.success) {
                                                    toast({
                                                        title: "Charges Confirmed",
                                                        description: "Charges verified and moved to final billing stage."
                                                    });
                                                    loadHistory();
                                                    router.refresh();
                                                } else {
                                                    toast({ title: "Error", description: res.error as string || "Failed to confirm charge", variant: "destructive" });
                                                }
                                            } catch (err: any) {
                                                toast({ title: "Network Error", description: err.message, variant: "destructive" });
                                            } finally { setIsConfirming(null); }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg transition-all active:scale-95 flex items-center gap-2 font-black uppercase text-[8px] tracking-widest"
                                    >
                                        {isConfirming === event.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        Confirm
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    )

    const FormContent = (
        <Tabs defaultValue="new" className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="new">Record New</TabsTrigger>
                    <TabsTrigger value="history">History & Billing</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="new" className="flex-1 flex flex-col h-full mt-0">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8 bg-white dark:bg-indigo-500/5 rounded-[2.5rem] border border-slate-200 dark:border-indigo-500/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] mb-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                            {/* Product Search */}
                            <div className="lg:col-span-4 space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                                    <Search className="h-3 w-3" /> Universal Charge Search
                                </Label>
                                <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-between h-14 bg-slate-50/50 dark:bg-slate-900 rounded-2xl font-black text-xs uppercase tracking-tight border-slate-200 dark:border-slate-800 shadow-none hover:bg-white transition-all ring-offset-background focus-visible:ring-2 focus-visible:ring-indigo-600"
                                        >
                                            <div className="truncate flex items-center gap-3">
                                                <ScanLine className="h-4 w-4 text-indigo-600 shrink-0" />
                                                {selectedProduct ? selectedProduct.label : "Find Pharmaceutical / Clinical Service..."}
                                            </div>
                                            <ChevronDown className="h-4 w-4 opacity-30" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                        className="w-[--radix-popover-trigger-width] p-0 rounded-2xl shadow-2xl border-slate-200 overflow-hidden" 
                                        align="start"
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <Command shouldFilter={false} className="rounded-none">
                                            <CommandInput 
                                                className="h-14 font-black"
                                                placeholder="Type service name (e.g. Observation, Dressing)..." 
                                                value={searchQuery}
                                                onValueChange={setSearchQuery}
                                            />
                                            <CommandList className="max-h-[300px]">
                                                {isSearching && <div className="p-10 flex flex-col items-center gap-3 text-xs opacity-50"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /><p className="font-black uppercase tracking-widest text-[9px]">Indexing clinical items...</p></div>}
                                                <CommandEmpty className="p-8 text-center"><p className="font-bold text-slate-400">No matching medical items found.</p></CommandEmpty>
                                                <CommandGroup>
                                                    {searchResults.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            onSelect={async () => {
                                                                setSelectedProduct(item);
                                                                setItemPrice(Number(item.price || 0));
                                                                setIsSearchOpen(false);
                                                                setSearchQuery('');
                                                                const res = await getProductAvailableUOMs(item.id);
                                                                if (res.success && res.data) {
                                                                    setAvailableUOMs(res.data);
                                                                    setSelectedUOM(res.data[0]?.uom || item.uom || "Unit");
                                                                } else {
                                                                    setAvailableUOMs([{ uom: item.uom || "Unit", factor: 1 }]);
                                                                    setSelectedUOM(item.uom || "Unit");
                                                                }
                                                                
                                                                // High speed focus jump - increased delay for animation stability
                                                                setTimeout(() => {
                                                                    if (qtyInputRef.current) {
                                                                        qtyInputRef.current.focus();
                                                                        qtyInputRef.current.select(); // Position cursor with select-all
                                                                    }
                                                                }, 150);
                                                            }}
                                                            className="flex flex-col items-start px-6 py-4 cursor-pointer hover:bg-slate-50"
                                                        >
                                                            <div className="font-black text-sm uppercase tracking-tighter text-slate-900">{item.label}</div>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{item.uom}</span>
                                                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {Number(item.price || 0).toFixed(2)}</span>
                                                                <span className="text-[10px] font-bold text-emerald-600">Stock: {item.totalStock}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Quantity */}
                            <div className="lg:col-span-2 space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Volume</Label>
                                <Input
                                    ref={qtyInputRef}
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.valueAsNumber)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            priceInputRef.current?.focus();
                                            priceInputRef.current?.select();
                                        }
                                    }}
                                    className="h-14 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-center text-lg rounded-2xl focus:bg-white transition-all"
                                />
                            </div>

                            {/* UOM */}
                            <div className="lg:col-span-2 space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Unit</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-14 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all">
                                            {selectedUOM || "Unit"} <ChevronDown className="ml-2 h-4 w-4 opacity-30" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-1 bg-white dark:bg-slate-950 border border-slate-200 rounded-xl shadow-2xl">
                                        <div className="grid gap-1">
                                            {availableUOMs.map((u) => (
                                                <button key={u.uom} type="button" onClick={() => setSelectedUOM(u.uom)} className={cn("w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", selectedUOM === u.uom ? "bg-indigo-600 text-white" : "hover:bg-slate-50")}>{u.uom}</button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Rate */}
                            <div className="lg:col-span-3 space-y-2">
                                <Label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                                    <Edit className="h-3 w-3" /> Sisters Custom Rate
                                </Label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">₹</div>
                                    <Input
                                        ref={priceInputRef}
                                        type="number"
                                        value={itemPrice}
                                        onChange={(e) => setItemPrice(Number(e.target.value))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addItem();
                                            }
                                        }}
                                        className="h-14 pl-14 bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-base rounded-2xl focus:bg-indigo-50/20 focus:ring-indigo-600 transition-all"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 group-hover:text-amber-500 transition-colors uppercase italic">Manual Override</div>
                                </div>
                            </div>

                            {/* Add Action */}
                            <div className="lg:col-span-1">
                                <Button
                                    type="button"
                                    onClick={addItem}
                                    disabled={!selectedProduct}
                                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/30 active:scale-95 transition-all group border-b-4 border-indigo-800"
                                >
                                    <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-12 bg-slate-50/30 border-dashed border-slate-200 rounded-xl text-xs font-bold px-6 italic"
                                placeholder="Add specific treatment notes if required (e.g. Emergency dressing, extra dose)..."
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                        <CartList />
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-950/50 backdrop-blur-sm sticky bottom-0 z-20 pb-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="font-bold text-slate-500"
                            onClick={() => onCancel ? onCancel() : router.back()}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-xs tracking-widest px-8 shadow-lg shadow-orange-600/20 rounded-xl py-6"
                            disabled={isSubmitting || cart.length === 0}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Posting...
                                </>
                            ) : (
                                `Post Changes (${cart.length} Items)`
                            )}
                        </Button>
                    </div>
                </form>
            </TabsContent>

            <TabsContent value="history" className="flex-1 mt-0">
                <HistoryList />
            </TabsContent>
        </Tabs>
    );

    if (isModal) {
        return (
            <div className="h-full flex flex-col p-6 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div className="mb-6 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 italic">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <ScanLine className="h-5 w-5" />
                            </div>
                            NURSING CONSUMABLES
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1 pl-1">
                            PATIENT: <span className="font-extrabold text-slate-900 dark:text-white uppercase">{patientName}</span>
                        </p>
                    </div>
                    <div className="text-right hidden sm:block">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Encounter Point</div>
                        <div className="font-mono text-xs font-bold text-indigo-600">#{encounterId.slice(0, 8)}</div>
                    </div>
                </div>
                {FormContent}
            </div>
        )
    }

    return (
        <Card className="w-full max-w-[95vw] lg:max-w-7xl mx-auto shadow-2xl border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-8">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200">
                        <PackageMinus className="h-7 w-7" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black italic tracking-tighter">Usage Terminal</CardTitle>
                        <CardDescription className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">
                            Consumables & Clinical Flowsheet entry for {patientName}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                {FormContent}
            </CardContent>
        </Card>
    )
}
