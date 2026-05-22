'use client'

import { createProduct, updateProduct, createUOM, updateProductBatch, getBatchHistory, adjustStock, deleteProduct } from "@/app/actions/inventory"
import { uploadProductImage } from "@/app/actions/upload-image"
import { useState, useRef, useEffect, useActionState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { QuickCategoryForm, QuickManufacturerForm } from "@/components/inventory/quick-create-wrappers"
import {
    Box, Tag, DollarSign, Layers, Image as ImageIcon, Barcode, Factory, Check, Zap, Info, Plus, X, Cpu, History, ArrowUpDown, TrendingUp, TrendingDown, Trash2
} from "lucide-react"
import { toast } from "sonner"

interface ProductFormProps {
    suppliers: { id: string, name: string }[];
    taxRates: { id: string, name: string, rate: any }[];
    uoms: { id: string, name: string, category_id: string, ratio: any, uom_type: any }[];
    categories: { id: string, name: string, default_tax_rate_id: string | null }[];
    manufacturers: { id: string, name: string }[];
    uomCategories: any[];
    initialData?: any;
    batches?: any[];
    onSuccess?: (createdId?: string, createdName?: string) => void;
    onCancel?: () => void;
}

export function ProductForm({ suppliers, taxRates, uoms, categories, manufacturers, uomCategories, initialData, batches: initialBatches = [], onSuccess, onCancel }: ProductFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [modalOpen, setModalOpen] = useState<'none' | 'category' | 'manufacturer' | 'uom'>('none');

    // Image Upload State
    const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl || null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State for dynamic behavior
    const generalCategory = categories.find(c => c.name === "General");
    const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.categoryId || generalCategory?.id || "");
    const [selectedTaxId, setSelectedTaxId] = useState(initialData?.taxRateId || "");
    const [trackingType, setTrackingType] = useState(initialData?.tracking || "none");

    // UOM: Controlled state — pre-select product's UOM on edit, first UOM on create
    const defaultUomId = initialData?.uom_id
        || uoms.find(u => u.name === initialData?.uom)?.id
        || uoms[0]?.id
        || "";
    const [selectedUomId, setSelectedUomId] = useState(defaultUomId);
    const [batches, setBatches] = useState(initialBatches);
    const [editingBatch, setEditingBatch] = useState<any>(null);
    const [adjustingBatch, setAdjustingBatch] = useState<any>(null);
    const [historyBatch, setHistoryBatch] = useState<any>(null);
    const [batchLedger, setBatchLedger] = useState<any[]>([]);

    const isEditing = !!initialData;
    const category = categories.find(c => c.id === selectedCategoryId);

    // Sync UOM selection when uoms list or initialData changes
    useEffect(() => {
        if (!selectedUomId && uoms.length > 0) {
            const defaultId = initialData?.uom_id
                || uoms.find(u => u.name?.toLowerCase() === initialData?.uom?.toLowerCase())?.id
                || uoms[0]?.id;
            if (defaultId) setSelectedUomId(defaultId);
        }
    }, [uoms, initialData, selectedUomId]);

    // Auto-select Tax Rate when Category changes
    useEffect(() => {
        if (selectedCategoryId) {
            const cat = categories.find(c => c.id === selectedCategoryId);
            if (cat && cat.default_tax_rate_id) {
                setSelectedTaxId(cat.default_tax_rate_id);
            }
        }
    }, [selectedCategoryId, categories]);

    function handleQuickSuccess() {
        setModalOpen('none');
        router.refresh();
    }


    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        const res = await uploadProductImage(formData);

        if (res.error) {
            toast.error(res.error);
        } else if (res.url) {
            setImageUrl(res.url);
            toast.success("Image uploaded successfully");
        }
        setUploading(false);
    }

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        const action = isEditing ? updateProduct : createProduct;

        if (isEditing) {
            formData.append('id', initialData.id);
        }

        const res = await action(formData);

        if (res?.error) {
            toast.error(res.error);
            setIsSubmitting(false);
        } else {
            toast.success(isEditing ? "Product updated successfully" : "Product created successfully");
            if (onSuccess) {
                onSuccess((res as any)?.productId, (res as any)?.name);
            } else {
                router.push('/hms/inventory/products');
                router.refresh();
            }
        }
    }

    return (
        <div className="relative">
            <form action={handleSubmit} className="w-full animate-in fade-in duration-500">
                {/* Sticky Header */}
                <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 -mx-6 px-6 py-4 mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-gradient-to-br from-black to-gray-800 rounded-xl flex items-center justify-center shadow-lg shadow-gray-200">
                            <Box className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                                {isEditing ? 'Edit Product' : 'New Product'}
                            </h1>
                            <p className="text-xs font-medium text-gray-500">
                                {isEditing ? `Ref: ${initialData?.sku}` : 'Configure your new inventory item'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (confirm(`Are you sure you want to PERMANENTLY delete "${initialData.name}"?`)) {
                                            setIsSubmitting(true);
                                            const res = await deleteProduct(initialData.id);
                                            setIsSubmitting(false);
                                            if (res.success) {
                                                toast.success("Product deleted successfully");
                                                if (onSuccess) onSuccess();
                                            } else {
                                                toast.error("Deletion Failed", { description: res.error });
                                            }
                                        }
                                    }}
                                    className="px-4 py-2 border-2 border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Delete Product
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (onCancel) onCancel();
                                else router.back();
                            }}
                            disabled={isSubmitting}
                            className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-black hover:bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg shadow-gray-300 transition-all transform hover:scale-[1.02] flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Zap className="h-4 w-4 fill-current" />
                            )}
                            {isEditing ? 'Save Changes' : 'Create Product'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-2">
                    {/* Left Column: Identity & Categorization (Span 3) */}
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Name - Span 2 */}
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Product Name <span className="text-red-500">*</span></label>
                            <input
                                name="name"
                                required
                                defaultValue={initialData?.name}
                                placeholder="Product Name"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        {/* SKU */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">SKU / Code <span className="text-red-500">*</span></label>
                            <input
                                name="sku"
                                required
                                defaultValue={initialData?.sku}
                                placeholder="SKU"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all font-mono text-sm"
                            />
                        </div>

                        {/* UOM - Serious Mandatory Node */}
                        <div className="space-y-1 p-2 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-1">
                                UOM <span className="text-rose-500">*</span>
                                {uoms.length === 0 && <span className="text-[8px] font-bold text-rose-400 normal-case">(No units configured)</span>}
                            </label>
                            <div className="flex gap-1">
                                <select
                                    name="uomId"
                                    required
                                    value={selectedUomId}
                                    onChange={(e) => setSelectedUomId(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold text-slate-700 shadow-sm"
                                >
                                    <option value="">Select UOM...</option>
                                    {uoms.length > 0 ? (
                                        Object.entries(uoms.reduce((acc: any, u: any) => {
                                            const cat = uomCategories.find(c => c.id === u.category_id)?.name || 'General';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(u);
                                            return acc;
                                        }, {})).map(([cat, items]: [string, any]) => (
                                            <optgroup key={cat} label={cat}>
                                                {items.map((u: any) => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                        ))
                                    ) : (
                                        <option disabled>Please add a UOM first</option>
                                    )}
                                </select>
                                <button 
                                    type="button" 
                                    onClick={() => setModalOpen('uom')} 
                                    className="p-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 text-indigo-600 shadow-sm transition-colors"
                                    title="Add New Unit of Measure"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                            <div className="flex gap-1">
                                <select
                                    name="categoryId"
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all text-sm"
                                >
                                    <option value="">Select Category...</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setModalOpen('category')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><Plus className="h-4 w-4" /></button>
                            </div>
                        </div>

                        {/* Manufacturer */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Brand / Mfr</label>
                            <div className="flex gap-1">
                                <select
                                    name="manufacturerId"
                                    defaultValue={initialData?.manufacturerId}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black outline-none transition-all text-sm"
                                >
                                    <option value="">Select Brand...</option>
                                    {manufacturers.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setModalOpen('manufacturer')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><Plus className="h-4 w-4" /></button>
                            </div>
                        </div>



                        {/* Pricing Row - Master Defaults */}
                        <div className="md:col-span-3 grid grid-cols-4 gap-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Std Sale Price</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{'₹'}</span>
                                    <input name="price" type="number" step="0.01" required defaultValue={initialData?.price} className="w-full pl-5 pr-2 py-2 bg-white border border-gray-200 rounded-lg font-bold text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Std Cost Price</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{'₹'}</span>
                                    <input name="costPrice" type="number" step="0.01" defaultValue={initialData?.default_cost} className="w-full pl-5 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Std MRP</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{'₹'}</span>
                                    <input name="mrp" type="number" step="0.01" defaultValue={initialData?.mrp} className="w-full pl-5 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Default Tax</label>
                                <select name="taxRateId" value={selectedTaxId} onChange={e => setSelectedTaxId(e.target.value)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs">
                                    <option value="">No Tax</option>
                                    {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({Number(t.rate)}%)</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Identification & Policy Row */}
                        <div className="md:col-span-3 grid grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Barcode</label>
                                <input name="barcode" defaultValue={initialData?.default_barcode} placeholder="Scan..." className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Tracking</label>
                                <select name="tracking" value={trackingType} onChange={e => setTrackingType(e.target.value)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs">
                                    <option value="none">None</option>
                                    <option value="batch">Batch</option>
                                    <option value="serial">Serial</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Reorder Lvl</label>
                                <input name="reorderLevel" type="number" step="0.01" defaultValue={Number(initialData?.reorder_level || 0)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                            </div>
                            {/* Empty space to keep grid consistent */}
                            <div className="hidden md:block"></div>
                        </div>

                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                <input type="checkbox" name="is_service" id="is_service" defaultChecked={initialData?.is_service} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                                <label htmlFor="is_service" className="cursor-pointer">
                                    <span className="block text-xs font-bold text-indigo-900 uppercase">Service Item</span>
                                    <span className="block text-[10px] text-indigo-600 leading-tight">Consultations, fees etc. No stock tracking.</span>
                                </label>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Short Description</label>
                                <input name="description" defaultValue={initialData?.description} placeholder="A brief note about this product" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Image & Actions (Span 1) */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-black transition-all" onClick={() => fileInputRef.current?.click()}>
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} disabled={uploading} />
                            <input type="hidden" name="image_url" value={imageUrl || ''} />
                            
                            {uploading && (
                                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}

                            {imageUrl ? (
                                <>
                                    <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                        <span className="text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded-full">Change Photo</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-gray-400">
                                    <ImageIcon className="h-6 w-6" />
                                    <span className="text-[10px] font-bold uppercase">Add Photo</span>
                                </div>
                            )}
                        </div>

                        {/* Batch History (if editing) */}
                        {isEditing && trackingType === 'batch' && batches.length > 0 && (
                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Active Batches</h4>
                                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                    {batches.map((batch: any) => (
                                        <div key={batch.id} className="group border-b border-gray-50 py-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-mono font-bold text-gray-700">{batch.batch_no}</span>
                                                <span className="text-[11px] font-black text-emerald-600">{Number(batch.qty_on_hand)} {initialData?.uom}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingBatch(batch)}
                                                    className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustingBatch(batch)}
                                                    className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-amber-600 hover:text-white transition-all"
                                                >
                                                    Adjust
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setHistoryBatch(batch);
                                                        const res = await getBatchHistory(batch.id);
                                                        if (res.success) setBatchLedger(res.data);
                                                    }}
                                                    className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-slate-900 hover:text-white transition-all"
                                                >
                                                    Ledger
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-1">
                            <div className="flex items-center gap-1 text-amber-800">
                                <Info className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase">Quick Tip</span>
                            </div>
                            <p className="text-[10px] text-amber-700 leading-tight">SKU must be unique. Categories help automate taxes and reporting.</p>
                        </div>
                    </div>
                </div>
            </form >

            {/* QUICK CREATE MODALS */}
            {
                modalOpen !== 'none' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-gray-900 capitalize">New {modalOpen}</h3>
                                <button onClick={() => setModalOpen('none')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="h-4 w-4 text-gray-500" />
                                </button>
                            </div>

                            {modalOpen === 'category' && (
                                <QuickCategoryForm onSuccess={handleQuickSuccess} />
                            )}

                            {modalOpen === 'manufacturer' && (
                                <QuickManufacturerForm onSuccess={handleQuickSuccess} />
                            )}


                            {modalOpen === 'uom' && (
                                <UOMQuickCreate
                                    categories={uomCategories}
                                    uoms={uoms}
                                    onClose={() => setModalOpen('none')}
                                    onRefresh={() => router.refresh()}
                                />
                            )}
                        </div>
                    </div>
                )
            }

            {/* BATCH EDIT MODAL */}
            {editingBatch && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Edit Batch: {editingBatch.batch_no}</h3>
                            <button onClick={() => setEditingBatch(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>
                        <BatchEditForm
                            batch={editingBatch}
                            onSuccess={() => {
                                setEditingBatch(null);
                                router.refresh();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* BATCH ADJUST MODAL */}
            {adjustingBatch && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Adjust Batch Stock</h3>
                                <p className="text-xs text-gray-500 font-mono">Lot: {adjustingBatch.batch_no}</p>
                            </div>
                            <button onClick={() => setAdjustingBatch(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>
                        <BatchAdjustForm
                            batch={adjustingBatch}
                            onSuccess={() => {
                                setAdjustingBatch(null);
                                router.refresh();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* BATCH HISTORY MODAL */}
            {historyBatch && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 m-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Batch Stock Ledger</h3>
                                <p className="text-xs text-gray-500">History for Lot: {historyBatch.batch_no}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setHistoryBatch(null);
                                    setBatchLedger([]);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-3">
                                {batchLedger.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-400 text-sm">No ledger entries found for this batch.</p>
                                    </div>
                                ) : (
                                    batchLedger.map((entry: any) => (
                                        <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${entry.movement_type.includes('in')
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-red-100 text-red-600'
                                                    }`}>
                                                    {entry.movement_type.includes('in') ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 capitalize">
                                                        {entry.movement_type.replace('-', ' ')}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(entry.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${entry.movement_type.includes('in') ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {entry.movement_type.includes('in') ? '+' : '-'}{Number(entry.qty).toFixed(2)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-mono">
                                                    Ref: {entry.reference || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}

function UOMQuickCreate({ categories, uoms, onClose, onRefresh }: { categories: any[], uoms: any[], onClose: () => void, onRefresh: () => void }) {
    const [catId, setCatId] = useState(categories[0]?.id || "");
    const [type, setType] = useState("reference");
    const [ratio, setRatio] = useState(1);
    const [name, setName] = useState("");

    // Find reference unit for selected category
    const refUom = uoms.find(u => u.category_id === catId && u.uom_type === 'reference');
    const refName = refUom ? refUom.name : "Ref Unit";

    const [state, action, isPending] = useActionState(createUOM, { error: "" });

    useEffect(() => {
        if (state && !('error' in state)) {
            onClose();
            onRefresh();
        }
    }, [state, onClose, onRefresh]);

    return (
        <form action={action} className="space-y-4">
            {state && 'error' in state && state.error && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{state.error}</div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UOM Name (e.g. Box)</label>
                <input
                    name="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                    placeholder="e.g. Box"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                    name="categoryId"
                    value={catId}
                    onChange={e => setCatId(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg outline-none cursor-pointer"
                >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Units in same category can be converted.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                        name="type"
                        value={type}
                        onChange={e => setType(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg outline-none cursor-pointer"
                    >
                        <option value="reference">Reference Unit</option>
                        <option value="bigger">Bigger than Ref</option>
                        <option value="smaller">Smaller than Ref</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ratio</label>
                    <input
                        name="ratio"
                        type="number"
                        step="0.0001"
                        value={ratio}
                        onChange={e => setRatio(Number(e.target.value))}
                        disabled={type === 'reference'}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                </div>
            </div>

            {/* Dynamic Helper Text */}
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                    {type === 'reference' ? (
                        <p>This will be the <strong>base unit</strong> for {categories.find(c => c.id === catId)?.name}. (1 {name || 'Unit'} = 1 {name || 'Unit'})</p>
                    ) : type === 'bigger' ? (
                        <p><strong>1 {name || 'Unit'}</strong> = <strong>{ratio} {refName}</strong></p>
                    ) : (
                        <p><strong>1 {name || 'Unit'}</strong> = <strong>{ratio} {refName}</strong> (or 1 {refName} = {1 / ratio} {name})</p>
                    )}
                    {!refUom && type !== 'reference' && (
                        <p className="text-red-600 mt-1 font-bold text-xs">Warning: No Reference Unit found for this category yet!</p>
                    )}
                </div>
            </div>

            <button type="submit" className="w-full py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors mt-2">Create UOM</button>
        </form>
    );
}
// --- Batch Management Component ---

function BatchEditForm({ batch, onSuccess }: { batch: any, onSuccess: () => void }) {
    const [state, action, isPending] = useActionState(updateProductBatch, { error: "" });

    useEffect(() => {
        if (state && !('error' in state)) {
            onSuccess();
        }
    }, [state, onSuccess]);

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={batch.id} />

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Market Retail Price (MRP)</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">\u20B9</span>
                    <input
                        name="mrp"
                        type="number"
                        step="0.01"
                        defaultValue={Number(batch.mrp || 0)}
                        className="w-full pl-7 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry Date</label>
                <input
                    name="expiryDate"
                    type="date"
                    defaultValue={batch.expiry_date ? new Date(batch.expiry_date).toISOString().split('T')[0] : ''}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
            </div>

            {state && 'error' in state && state.error && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{state.error}</p>
            )}

            <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
                {isPending ? 'Updating...' : 'Save Changes'}
            </button>
        </form>
    );
}

function BatchAdjustForm({ batch, onSuccess }: { batch: any, onSuccess: () => void }) {
    const [state, action, isPending] = useActionState(adjustStock, { error: "" });
    const [type, setType] = useState<'add' | 'remove'>('add');

    useEffect(() => {
        if (state && !('error' in state)) {
            onSuccess();
        }
    }, [state, onSuccess]);

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="batchId" value={batch.id} />

            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                    type="button"
                    onClick={() => setType('add')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'add' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
                        }`}
                >
                    Add Stock
                </button>
                <button
                    type="button"
                    onClick={() => setType('remove')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'remove' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                        }`}
                >
                    Remove Stock
                </button>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity to {type}</label>
                <input
                    name="changeQty"
                    type="number"
                    step="0.01"
                    required
                    placeholder={`Qty to ${type}...`}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                />
                <input type="hidden" name="multiplier" value={type === 'add' ? "1" : "-1"} />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</label>
                <select
                    name="reason"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none cursor-pointer"
                >
                    <option value="Manual Adjustment">Manual Adjustment</option>
                    <option value="Damage">Damage / Spillage</option>
                    <option value="Expiry Return">Expiry Return</option>
                    <option value="Audit Correction">Audit Correction</option>
                    <option value="Sample / Gift">Sample / Gift</option>
                </select>
            </div>

            {state && 'error' in state && state.error && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{state.error}</p>
            )}

            <button
                type="submit"
                disabled={isPending}
                className={`w-full py-2.5 text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 ${type === 'add' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                    }`}
            >
                {isPending ? 'Processing...' : `Confirm ${type === 'add' ? 'Addition' : 'Removal'}`}
            </button>
        </form>
    );
}
