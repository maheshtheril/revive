'use client'

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { bulkUpdateProducts } from "@/app/actions/inventory"
import { toast } from "@/components/ui/use-toast"
import { Loader2, AlertCircle, Layers, Settings2, Trash2 } from "lucide-react"

interface BulkEditModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    selectedIds: string[]
    categories: any[]
}

export function BulkEditModal({
    isOpen,
    onClose,
    onSuccess,
    selectedIds,
    categories
}: BulkEditModalProps) {
    const [loading, setLoading] = useState(false)

    // Updates State
    const [updateCategory, setUpdateCategory] = useState(false)
    const [categoryId, setCategoryId] = useState("")

    const [updateServiceStatus, setUpdateServiceStatus] = useState(false)
    const [isService, setIsService] = useState(false)

    const [updateStockable, setUpdateStockable] = useState(false)
    const [isStockable, setIsStockable] = useState(true)

    const [updatePrice, setUpdatePrice] = useState(false)
    const [price, setPrice] = useState<number | "">("")

    const handleApply = async () => {
        if (!updateCategory && !updateServiceStatus && !updateStockable && !updatePrice) {
            toast({ title: "Operation Canceled", description: "No changes selected for bulk update." })
            return
        }

        setLoading(true)
        try {
            const updates: any = {}
            if (updateCategory) updates.categoryId = categoryId
            if (updateServiceStatus) updates.isService = isService
            if (updateStockable) updates.isStockable = isStockable
            if (updatePrice && price !== "") updates.price = Number(price)

            const res = await bulkUpdateProducts(selectedIds, updates)
            if (res.success) {
                toast({ title: "Bulk Update Finished", description: res.message })
                onSuccess()
                onClose()
            } else {
                toast({ title: "Sync Interrupted", description: res.error, variant: "destructive" })
            }
        } catch (err) {
            toast({ title: "System Error", description: "Could not execute batch operation.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-950">
                <div className="bg-slate-900 p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <Layers className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Bulk <span className="text-indigo-400">Processor</span>
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Updating {selectedIds.length} registry nodes simultaneously
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Category Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="update-category"
                                checked={updateCategory}
                                onCheckedChange={(v) => setUpdateCategory(!!v)}
                            />
                            <Label htmlFor="update-category" className="text-xs font-black uppercase tracking-widest text-slate-500 select-none">Change Category</Label>
                        </div>
                        <select
                            disabled={!updateCategory || loading}
                            className={`w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${!updateCategory ? 'opacity-40 grayscale' : ''}`}
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                        >
                            <option value="">Select Target Category...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Service Flag */}
                        <div className={`p-4 rounded-2xl border transition-all ${updateServiceStatus ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-500/5 dark:border-indigo-500/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Checkbox
                                    id="update-service"
                                    checked={updateServiceStatus}
                                    onCheckedChange={(v) => setUpdateServiceStatus(!!v)}
                                />
                                <Label htmlFor="update-service" className="text-[10px] font-black uppercase tracking-widest text-slate-500 select-none">Mark as Service</Label>
                            </div>
                            <select
                                disabled={!updateServiceStatus || loading}
                                className="w-full bg-transparent text-xs font-bold outline-none disabled:opacity-40"
                                value={isService ? 'true' : 'false'}
                                onChange={(e) => setIsService(e.target.value === 'true')}
                            >
                                <option value="false">Physical Item</option>
                                <option value="true">Service Node</option>
                            </select>
                        </div>

                        {/* Stockable Flag */}
                        <div className={`p-4 rounded-2xl border transition-all ${updateStockable ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-500/5 dark:border-indigo-500/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Checkbox
                                    id="update-stockable"
                                    checked={updateStockable}
                                    onCheckedChange={(v) => setUpdateStockable(!!v)}
                                />
                                <Label htmlFor="update-stockable" className="text-[10px] font-black uppercase tracking-widest text-slate-500 select-none">Stock Tracking</Label>
                            </div>
                            <select
                                disabled={!updateStockable || loading}
                                className="w-full bg-transparent text-xs font-bold outline-none disabled:opacity-40"
                                value={isStockable ? 'true' : 'false'}
                                onChange={(e) => setIsStockable(e.target.value === 'true')}
                            >
                                <option value="true">Inventory On</option>
                                <option value="false">Inventory Off</option>
                            </select>
                        </div>
                    </div>

                    {/* Price Adjustment */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="update-price"
                                checked={updatePrice}
                                onCheckedChange={(v) => setUpdatePrice(!!v)}
                            />
                            <Label htmlFor="update-price" className="text-xs font-black uppercase tracking-widest text-slate-500 select-none">Mass Price Update</Label>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 italic">₹</span>
                            <Input
                                type="number"
                                disabled={!updatePrice || loading}
                                className={`h-12 pl-8 border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-lg ${!updatePrice ? 'opacity-40grayscale' : ''}`}
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : "")}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        disabled={loading}
                        className="flex-[1.5] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings2 className="h-4 w-4 mr-2" />}
                        Apply Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
