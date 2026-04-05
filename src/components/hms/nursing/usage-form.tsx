'use client'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { consumeStockBulk, ConsumptionItem, confirmNursingConsumption } from "@/app/actions/nursing-inventory"
import { getConsumptionHistory } from "@/app/actions/nursing-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { getProductsPremium } from "@/app/actions/inventory"
import { Loader2, Check, PackageMinus, Plus, Trash2, ShoppingCart, Info, ScanLine, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isConfirming, setIsConfirming] = useState<string | null>(null)

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([])

    // Current Item State (Transient)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState("")

    const [history, setHistory] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

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
            uom: selectedProduct.uom,
            stock: selectedProduct.totalStock,
            price: Number(selectedProduct.price || 0),
            notes: notes
        }

        setCart(prev => [...prev, newItem])

        // Reset Inputs
        setSelectedProduct(null)
        setQuantity(1)
        setNotes("")
        toast({
            description: "Item added to list",
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
                items: cart.map(({ productId, quantity, notes }) => ({ productId, quantity, notes })),
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
        <div className="space-y-3 mb-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 h-[300px] overflow-y-auto font-mono">
            <AnimatePresence>
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Consumption list is empty</p>
                        <p className="text-xs">Add items above to record usage</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3 group"
                        >
                            <div className="h-10 w-10 rounded bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shrink-0">
                                <PackageMinus className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate pr-2">{item.productName}</h4>
                                    <div className="flex flex-col items-end">
                                        <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                            {item.quantity} {item.uom}
                                        </span>
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                            Rate: ₹{item.price.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                {item.notes && (
                                    <p className="text-xs text-slate-500 mt-1 italic">"{item.notes}"</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="md:opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))
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
        <Tabs defaultValue="new" className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="new">Record New</TabsTrigger>
                    <TabsTrigger value="history">History & Billing</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="new" className="flex-1 flex flex-col h-full mt-0">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="grid grid-cols-1 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Product / Medicine</Label>
                            <SearchableSelect
                                value={selectedProduct?.id}
                                valueLabel={selectedProduct?.name}
                                placeholder="Search inventory..."
                                onSearch={async (q) => {
                                    const res = await getProductsPremium(q, 1);
                                    if (res.success && res.data) {
                                        return res.data.map((p: any) => ({
                                            id: p.id,
                                            label: p.name,
                                            subLabel: `S: ${p.totalStock} ${p.uom} | ₹${Number(p.price || 0).toFixed(2)}`,
                                            ...p
                                        }));
                                    }
                                    return [];
                                }}
                                onChange={(val, opt) => {
                                    if (opt) {
                                        setSelectedProduct(opt);
                                    } else {
                                        setSelectedProduct(null);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex items-end gap-3">
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Qty</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.valueAsNumber)}
                                        className="bg-white dark:bg-slate-800 font-bold h-11 text-lg shadow-inner"
                                    />
                                    {selectedProduct && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-black text-indigo-500 bg-indigo-50 px-1 rounded">
                                            {selectedProduct.uom}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={addItem}
                                disabled={!selectedProduct}
                                className="h-11 px-6 bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add to List
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-4 min-h-[150px]">
                        <CartList />
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
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
            <div className="h-full flex flex-col p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 italic">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <ScanLine className="h-5 w-5" />
                            </div>
                            NURSING FLOWSHEET
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
        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-8">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200">
                        <PackageMinus className="h-7 w-7" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black italic tracking-tighter">Usage Terminal</CardTitle>
                        <CardDescription className="font-bold text-slate-500">
                            Flowsheet entry for {patientName}
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
