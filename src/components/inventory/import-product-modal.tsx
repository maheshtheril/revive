'use client'
import { useState } from "react"
import { Upload, X, FileSpreadsheet, Loader2, Download, AlertTriangle, CheckCircle, Info, Scan, Sparkles, Image as ImageIcon, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { importProductsCSV } from "@/app/actions/inventory"
import { scanProductListAction, bulkImportProducts } from "@/app/actions/product-scan"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

export function ImportProductModal({ defaultOpen = false }: { defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const [isPending, setIsPending] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [mode, setMode] = useState<'csv' | 'ai'>('csv')
    const [scannedItems, setScannedItems] = useState<any[] | null>(null)
    const router = useRouter()

    const handleDownloadTemplate = () => {
        const headers = ["Name", "Product Type", "Generic Name", "Manufacturer", "Category", "UOM", "Purchase Price", "Sale Price", "MRP", "GST %", "HSN Code", "Opening Stock", "Min Stock", "SKU", "BarCode"];
        const sampleRow = ["Paracetamol 500mg", "Medicine", "Paracetamol", "GSK Pharma", "Pharmacy", "STRIP", "15.00", "25.00", "30.00", "12", "3004", "100", "10", "PRC-500", "890123456789"];
        const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'hms_product_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleSubmitCSV = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsPending(true)
        setResult(null)
        const formData = new FormData(e.currentTarget)
        const res = await importProductsCSV(formData)
        if (res.success) {
            toast.success(res.message || `Successfully processed import!`)
            setResult(res)
            router.refresh()
        } else {
            toast.error(res.error || "Failed to import")
        }
        setIsPending(false)
    }

    const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        
        setIsPending(true)
        setScannedItems(null)
        
        const formData = new FormData()
        formData.append('file', e.target.files[0])
        
        const res = await scanProductListAction(formData)
        
        if (res.success && res.data) {
            toast.success(`Scan complete! Found ${res.data.length} items.`)
            setScannedItems(res.data)
        } else {
            toast.error(res.error || "Failed to scan image")
        }
        setIsPending(false)
    }

    const handleSaveScanned = async () => {
        if (!scannedItems || scannedItems.length === 0) return
        
        setIsPending(true)
        const res = await bulkImportProducts(scannedItems)
        
        if (res.success) {
            toast.success(`Successfully imported ${res.count} products!`)
            setResult(res)
            setScannedItems(null)
            router.refresh()
        } else {
            toast.error(res.error || "Failed to save products")
        }
        setIsPending(false)
    }

    const removeScannedItem = (index: number) => {
        if (!scannedItems) return
        const updated = [...scannedItems]
        updated.splice(index, 1)
        setScannedItems(updated)
    }

    const resetState = () => {
        setResult(null)
        setScannedItems(null)
        setMode('csv')
        setIsOpen(false)
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 group"
            >
                <div className="bg-blue-100 p-1 rounded-md text-blue-700 group-hover:bg-blue-200 transition-colors">
                    <Upload className="h-4 w-4" />
                </div>
                Import Products
            </button>

            <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetState(); }}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Product Import Engine</DialogTitle>
                        <DialogDescription>Import products via CSV or AI-powered Image Scanning.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 md:p-10 relative animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-200 pb-6">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/20">
                                    <Scan className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Engine</h2>
                                    <p className="text-slate-500 font-medium">Bulk register your inventory with ease.</p>
                                </div>
                            </div>

                            {!result && !scannedItems && (
                                <div className="flex bg-slate-200/50 p-1.5 rounded-2xl self-start md:self-center">
                                    <button 
                                        onClick={() => setMode('csv')}
                                        className={`px-5 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm flex items-center gap-2 ${mode === 'csv' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Excel / CSV
                                    </button>
                                    <button 
                                        onClick={() => setMode('ai')}
                                        className={`px-5 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm flex items-center gap-2 ${mode === 'ai' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        AI Image Scan
                                    </button>
                                </div>
                            )}
                        </div>

                        {!result && !scannedItems && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 transition-all">
                                {mode === 'csv' ? (
                                    <form onSubmit={handleSubmitCSV} className="space-y-8">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between shadow-sm">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                                    <Info className="h-5 w-5 text-white" />
                                                </div>
                                                <div className="text-sm">
                                                    <p className="font-extrabold text-indigo-950 text-lg mb-1">Spreadsheet Template</p>
                                                    <p className="text-indigo-800/70 font-medium">Use Excel or CSV with <strong>Category</strong> and <strong>GST %</strong> columns to ensure correct mapping.</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleDownloadTemplate}
                                                className="w-full md:w-auto px-10 py-4.5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all hover:scale-105 shadow-xl shadow-indigo-200"
                                            >
                                                Download Template
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {[
                                                { label: 'Default Category', name: 'defaultCategory', placeholder: 'Pharmacy' },
                                                { label: 'Default UOM', name: 'defaultUom', placeholder: 'UNIT', defaultValue: 'UNIT' },
                                                { label: 'Default Tax %', name: 'defaultTaxRate', placeholder: '0', defaultValue: '0' }
                                            ].map((field) => (
                                                <div key={field.name} className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{field.label}</label>
                                                    <input 
                                                        name={field.name} 
                                                        defaultValue={field.defaultValue}
                                                        placeholder={field.placeholder} 
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-slate-700 shadow-inner"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="border-4 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-12 flex flex-col items-center justify-center text-center bg-white transition-all cursor-pointer relative group/drop shadow-sm overflow-hidden">
                                            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover/drop:opacity-100 transition-opacity"></div>
                                            <input type="file" name="file" accept=".csv, .xlsx, .xls" required className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                            <div className="relative z-0">
                                                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5 group-hover/drop:scale-110 group-hover/drop:rotate-3 transition-all duration-300">
                                                    <FileSpreadsheet className="h-10 w-10 text-slate-400 group-hover/drop:text-blue-600" />
                                                </div>
                                                <p className="text-xl font-black text-slate-900 mb-2">Drop Excel or CSV File Here</p>
                                                <p className="text-sm text-slate-500 font-bold max-w-xs mx-auto">Click to browse your documents for inventory data.</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <button
                                                type="submit"
                                                disabled={isPending}
                                                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 flex items-center gap-3 text-lg"
                                            >
                                                {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                                                Process Catalog
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="bg-indigo-900 border border-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <Sparkles className="h-24 w-24" />
                                            </div>
                                            <div className="relative z-10 text-center space-y-4">
                                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/30 rounded-full text-xs font-black uppercase tracking-tighter border border-indigo-400/30 backdrop-blur-md mb-2">
                                                    <Sparkles className="h-4 w-4 text-yellow-400" />
                                                    Revolutionary AI Scan
                                                </div>
                                                <h3 className="text-3xl font-black mb-2">Import from Photo</h3>
                                                <p className="text-indigo-100/80 font-medium text-lg leading-relaxed max-w-lg mx-auto">
                                                    Snap a physical price list, screenshot a PDF, or upload any product image. Gemini will instantly turn them into data.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-4 border-dashed border-indigo-300 hover:border-indigo-600 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-white transition-all cursor-pointer relative group/ai shadow-lg overflow-hidden ring-4 ring-indigo-50/50">
                                            <div className="absolute inset-0 bg-indigo-50/30 opacity-0 group-hover/ai:opacity-100 transition-opacity"></div>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleScanImage} 
                                                disabled={isPending}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                            />
                                            <div className="relative z-0">
                                                <div className={`w-28 h-28 ${isPending ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-100'} rounded-[2.5rem] flex items-center justify-center mb-8 group-hover/ai:scale-110 group-hover/ai:-rotate-3 transition-all duration-500 shadow-xl shadow-indigo-200`}>
                                                    {isPending ? (
                                                        <Loader2 className="h-12 w-12 text-white animate-spin" />
                                                    ) : (
                                                        <ImageIcon className="h-12 w-12 text-indigo-600" />
                                                    )}
                                                </div>
                                                <p className="text-3xl font-black text-slate-900 mb-3">{isPending ? 'Scanning Image...' : 'Upload Image Catalog'}</p>
                                                <p className="text-base text-slate-500 font-bold max-w-sm mx-auto">We'll identify product names, packing units, and prices automatically using Vision AI.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {scannedItems && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                                            <Sparkles className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900">Scan Results</h3>
                                            <p className="text-slate-500 font-bold">Review and customize extracted data before final import.</p>
                                        </div>
                                    </div>
                                    <div className="px-5 py-2 bg-slate-200 rounded-full text-slate-700 font-black text-sm">
                                        {scannedItems.length} Products detected
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden max-h-[500px] flex flex-col">
                                    <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                                        <table className="w-full">
                                            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b-2 border-slate-100 z-10">
                                                <tr>
                                                    <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Name</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Packing</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">GST %</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Price/MRP</th>
                                                    <th className="px-6 py-5 text-right"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {scannedItems.map((item, idx) => (
                                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-5 font-extrabold text-slate-900">{item.name}</td>
                                                        <td className="px-6 py-5">
                                                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black">{item.packing}</span>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black">{item.gst || '0'}%</span>
                                                        </td>
                                                        <td className="px-6 py-5 font-black text-indigo-600">₹{item.mrp?.toLocaleString() || '0'}</td>
                                                        <td className="px-6 py-5 text-right">
                                                            <button 
                                                                onClick={() => removeScannedItem(idx)}
                                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            >
                                                                <Trash2 className="h-5 w-5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-5 pt-4">
                                    <button 
                                        onClick={() => setScannedItems(null)} 
                                        className="px-8 py-4 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all"
                                    >
                                        Discard Scan
                                    </button>
                                    <button
                                        onClick={handleSaveScanned}
                                        disabled={isPending}
                                        className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-600/30 disabled:opacity-50 flex items-center gap-3 text-lg"
                                    >
                                        {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle className="h-6 w-6" />}
                                        Finalize Import
                                    </button>
                                </div>
                            </div>
                        )}

                        {result && (
                            <div className="space-y-8 animate-in zoom-in-95 duration-500">
                                <div className={`p-10 rounded-[2.5rem] flex flex-col items-center text-center shadow-inner ${result.success ? 'bg-emerald-50 text-emerald-950 border-2 border-emerald-100' : 'bg-rose-50 text-rose-900'}`}>
                                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl ${result.success ? 'bg-emerald-600 text-white shadow-emerald-400/50' : 'bg-rose-600 text-white shadow-rose-400/50'}`}>
                                        {result.success ? <CheckCircle className="h-12 w-12" /> : <AlertTriangle className="h-12 w-12" />}
                                    </div>
                                    <h3 className="text-4xl font-black mb-2 tracking-tight">
                                        {result.success ? 'Victory!' : 'Process Interrupted'}
                                    </h3>
                                    <p className="text-lg font-bold opacity-80 max-w-sm">
                                        Successfully established <strong>{result.count}</strong> new products in your digital arsenal.
                                    </p>
                                </div>

                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={resetState}
                                        className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-slate-900/40 text-lg flex items-center gap-3"
                                    >
                                        Continue Operations
                                        <X className="h-5 w-5 opacity-50" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
