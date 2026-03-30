
'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" // Assuming these exist, otherwise standard table
import { Plus, Trash2, Calendar, Save, CheckCircle2, ChevronRight, Package, Search, Sparkles, Image as ImageIcon, Loader2 } from "lucide-react"
import { scanPurchaseReceiptAction } from "@/app/actions/product-scan"
import { useToast } from "@/components/ui/use-toast"
import { getProductsPremium, searchProducts } from "@/app/actions/inventory"
import { receiveStock, ReceiveStockData, ReceiveStockItem } from "@/app/actions/inventory-operations"

export default function ReceiveStockPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [step, setStep] = useState(1) // 1: Details, 2: Items, 3: Review

    // Form State
    const [formData, setFormData] = useState<Partial<ReceiveStockData>>({
        date: new Date(),
        reference: '',
        notes: '',
        items: []
    })

    // Item Adding State
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isScanningAI, setIsScanningAI] = useState(false)

    // New Item State
    const [currentItem, setCurrentItem] = useState<{
        product: any
        quantity: number
        unitCost: number
        mrp: number
        batchNumber: string
        expiryDate: string
    } | null>(null)

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 1) {
                setIsSearching(true)
                const res = await getProductsPremium(searchTerm)
                if (res?.success) {
                    setSearchResults(res.data)
                }
                setIsSearching(false)
            } else {
                setSearchResults([])
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm])

    const handleSelectProduct = (product: any) => {
        setSearchTerm('')
        setSearchResults([])
        setCurrentItem({
            product,
            quantity: 1,
            unitCost: product.default_cost || product.price || 0,
            mrp: product.mrp || 0,
            batchNumber: '',
            expiryDate: ''
        })
    }

    const handleAddItem = () => {
        if (!currentItem) return

        // Validation
        if (currentItem.quantity <= 0) {
            toast({ title: "Invalid Quantity", description: "Quantity must be greater than 0", variant: "destructive" })
            return
        }

        const metadata = currentItem.product.metadata || {}
        const isTracked = metadata.tracking === 'batch'

        if (isTracked && !currentItem.batchNumber) {
            toast({ title: "Batch Number Required", description: "This product is batch tracked. Please enter a batch number.", variant: "destructive" })
            return
        }

        const newItem: ReceiveStockItem = {
            productId: currentItem.product.id,
            quantity: currentItem.quantity,
            unitCost: currentItem.unitCost,
            mrp: currentItem.mrp,
            batchNumber: currentItem.batchNumber || undefined,
            expiryDate: currentItem.expiryDate || undefined
        }

        // Add to list (with product details for UI)
        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), { ...newItem, _productName: currentItem.product.name, _uom: currentItem.product.uom } as any]
        }))

        setCurrentItem(null)
    }

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.filter((_, i) => i !== index)
        }))
    }

    const handleAIScan = async (file: File) => {
        setIsScanningAI(true)
        const toastId = toast({ title: "AI Scanning...", description: "Identifying products and batch info..." })

        try {
            const formData = new FormData()
            formData.append('file', file)
            const result = await scanPurchaseReceiptAction(formData)

            if (result.success && result.data) {
                toast({ title: "Scan Complete", description: `Found ${result.data.length} items. Matching with inventory...` })
                
                const newItems: any[] = []
                for (const scanned of result.data) {
                    // Try to find matching product in DB
                    const searchRes = await searchProducts(scanned.name)
                    const matchedProduct = searchRes?.success && searchRes.data?.length > 0 ? searchRes.data[0] : null

                    if (matchedProduct) {
                        newItems.push({
                            productId: matchedProduct.id,
                            quantity: scanned.quantity || 1,
                            unitCost: scanned.unitCost || matchedProduct.default_cost || 0,
                            mrp: scanned.mrp || matchedProduct.mrp || 0,
                            batchNumber: scanned.batchNumber || '',
                            expiryDate: scanned.expiryDate || '',
                            _productName: matchedProduct.name,
                            _uom: matchedProduct.uom
                        })
                    } else {
                        toast({ title: "Product Not Found", description: `Could not find "${scanned.name}" in catalogue.`, variant: "destructive" })
                    }
                }

                if (newItems.length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        items: [...(prev.items || []), ...newItems]
                    }))
                    toast({ title: "Success", description: `Added ${newItems.length} items from scan.` })
                }
            } else {
                toast({ title: "Scan Failed", description: result.error || "Unknown error", variant: "destructive" })
            }
        } catch (e) {
            toast({ title: "Error", description: "AI Scanning failed.", variant: "destructive" })
        } finally {
            setIsScanningAI(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.items || formData.items.length === 0) {
            toast({ title: "No Items", description: "Please add at least one item", variant: "destructive" })
            return
        }

        setIsLoading(true)
        try {
            const result = await receiveStock(formData as ReceiveStockData)
            if (result.success) {
                toast({ title: "Success", description: "Stock received successfully", className: "bg-green-500 text-white" })
                router.push('/hms/inventory/products')
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" })
            }
        } catch (e) {
            toast({ title: "Error", description: "Something went wrong", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Receive Stock</h1>
                    <p className="text-gray-500 mt-1">Create a Purchase Receipt (GRN) to add stock.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) handleAIScan(e.target.files[0]);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isScanningAI}
                        />
                        <Button 
                            variant="outline" 
                            className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold gap-2"
                            disabled={isScanningAI}
                        >
                            {isScanningAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-indigo-500" />}
                            {isScanningAI ? "Scanning Receipt..." : "AI Scan Receipt"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Wizard Steps/Form */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Step 1: Basic Info */}
                    <Card className={step === 1 ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Receipt Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                                    onChange={e => setFormData(p => ({ ...p, date: new Date(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setFormData(p => ({
                                            ...p,
                                            reference: type === 'opening' ? 'OPENING-STOCK' : ''
                                        }));
                                    }}
                                >
                                    <option value="purchase">Purchase Receipt</option>
                                    <option value="opening">Opening Stock</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Reference (Optional)</Label>
                                <Input
                                    placeholder="e.g. PO-1234 or INV-5678"
                                    value={formData.reference}
                                    onChange={e => setFormData(p => ({ ...p, reference: e.target.value }))}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Internal Notes</Label>
                                <Input
                                    placeholder="Notes about this receipt..."
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Add Items */}
                    <Card className={step === 2 || (formData.items?.length || 0) > 0 ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Add Products
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Product Search */}
                            {!currentItem && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search product by name or SKU..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    {/* Search Results Dropdown */}
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {searchResults.map(prod => (
                                                <div
                                                    key={prod.id}
                                                    className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                                    onClick={() => handleSelectProduct(prod)}
                                                >
                                                    <div>
                                                        <div className="font-medium text-sm">{prod.name}</div>
                                                        <div className="text-xs text-gray-500">{prod.sku}</div>
                                                    </div>
                                                    <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                        {prod.totalStock} {prod.uom}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Selected Item Form */}
                            {currentItem && (
                                <div className="bg-gray-50 p-4 rounded-lg border space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                        <h3 className="font-semibold text-sm">{currentItem.product.name}</h3>
                                        <Button variant="ghost" size="sm" onClick={() => setCurrentItem(null)} className="h-6 w-6 p-0">×</Button>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Quantity</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={currentItem.quantity}
                                                    onChange={e => setCurrentItem(p => p ? ({ ...p, quantity: parseFloat(e.target.value) }) : null)}
                                                />
                                                <span className="text-xs text-gray-500 pt-2">{currentItem.product.uom}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Unit Cost (Buy Price)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={currentItem.unitCost}
                                                onChange={e => setCurrentItem(p => p ? ({ ...p, unitCost: parseFloat(e.target.value) }) : null)}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs">MRP (Sell Price)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={currentItem.mrp}
                                                onChange={e => setCurrentItem(p => p ? ({ ...p, mrp: parseFloat(e.target.value) }) : null)}
                                            />
                                        </div>

                                        {/* Dynamic Batch Fields */}
                                        {(currentItem.product.metadata?.tracking === 'batch') && (
                                            <>
                                                <div className="space-y-1.5 bg-yellow-50 p-2 rounded -mx-2 md:mx-0">
                                                    <Label className="text-xs text-yellow-800 font-semibold">Batch Number *</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        value={currentItem.batchNumber}
                                                        onChange={e => setCurrentItem(p => p ? ({ ...p, batchNumber: e.target.value }) : null)}
                                                        placeholder="Enter Batch #"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 bg-yellow-50 p-2 rounded -mx-2 md:mx-0">
                                                    <Label className="text-xs text-yellow-800 font-semibold">Expiry Date</Label>
                                                    <Input
                                                        type="date"
                                                        className="h-8 text-sm"
                                                        value={currentItem.expiryDate}
                                                        onChange={e => setCurrentItem(p => p ? ({ ...p, expiryDate: e.target.value }) : null)}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Button onClick={handleAddItem} className="w-full bg-blue-600 hover:bg-blue-700" size="sm">
                                        <Plus className="h-4 w-4 mr-2" /> Add Line Item
                                    </Button>
                                </div>
                            )}

                            {/* Added Items List */}
                            {formData.items && formData.items.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Product</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Cost</TableHead>
                                                <TableHead>MRP</TableHead>
                                                <TableHead>Batch Info</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {formData.items.map((item: any, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item._productName}</TableCell>
                                                    <TableCell>{item.quantity} {item._uom}</TableCell>
                                                    <TableCell>${item.unitCost.toFixed(2)}</TableCell>
                                                    <TableCell>${(item.mrp || 0).toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        {item.batchNumber ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-mono bg-gray-100 px-1 rounded w-fit">{item.batchNumber}</span>
                                                                {item.expiryDate && <span className="text-[10px] text-gray-500">Exp: {item.expiryDate}</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Right: Summary / Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Total Items</span>
                                <span className="font-medium">{formData.items?.length || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2">
                                <span className="text-gray-900 font-semibold">Total Value</span>
                                <span className="font-bold text-lg">
                                    ${formData.items?.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0).toFixed(2)}
                                </span>
                            </div>

                            <Button
                                className="w-full mt-4"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={isLoading || (formData.items?.length || 0) === 0}
                            >
                                {isLoading ? "Processing..." : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Confirm Receipt
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
