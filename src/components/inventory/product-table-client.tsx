'use client'

import { useState } from "react"
import Link from "next/link"
import { Package, TrendingUp, TrendingDown, Layers, Check, X, ShieldCheck, ChevronRight, Pencil, Trash2, MousePointerClick, Settings2, Trash } from "lucide-react"
import { EditProductModal } from "./edit-product-modal"
import { BulkEditModal } from "./bulk-edit-modal"
import { deleteProduct } from "@/app/actions/inventory"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

interface ProductTableClientProps {
    products: any[];
    meta: any;
    session: any;
    suppliers: any[];
    taxRates: any[];
    uoms: any[];
    categories: any[];
    manufacturers: any[];
    uomCategories: any[];
    query?: string;
    currentPage: number;
}

export function ProductTableClient({
    products,
    meta,
    session,
    suppliers,
    taxRates,
    uoms,
    categories,
    manufacturers,
    uomCategories,
    query,
    currentPage
}: ProductTableClientProps) {
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Multi-select logic
    const toggleAll = () => {
        if (selectedIds.length === products.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(products.map(p => p.id));
        }
    };

    const toggleOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const user = session?.user as any;
    const isAdmin = user?.isAdmin || user?.isTenantAdmin || user?.isPlatformAdmin || user?.role?.toLowerCase() === 'admin';

    const handleDelete = async (product: any) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete "${product.name}"? This action cannot be undone and will only succeed if there are zero transactions.`)) return;

        const res = await deleteProduct(product.id);
        if (res.success) {
            toast.success("Product Deleted Successfully");
        } else {
            toast.error("Deletion Blocked", { description: res.error });
        }
    };

    const rawCurrency = meta?.currencySymbol || session?.user?.currencySymbol || '₹';
    const currencySymbol = (rawCurrency && (rawCurrency.includes('Γé╣') || rawCurrency.length > 3)) ? '₹' : (rawCurrency || '₹');

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500 relative">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                                <th className="p-4 w-12 text-center group/all pointer-events-auto">
                                    <Checkbox
                                        checked={selectedIds.length > 0 && selectedIds.length === products.length}
                                        onCheckedChange={toggleAll}
                                        className="h-5 w-5 border-slate-400 dark:border-white/20 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-all shadow-sm"
                                    />
                                    <span className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover/all:opacity-100 transition-opacity bg-slate-900 text-white px-2 py-1 rounded text-[8px] whitespace-nowrap z-50">Select All Sector Products</span>
                                </th>
                                <th className="p-4 flex items-center gap-2">
                                    <span>Product Info</span>
                                    {selectedIds.length === 0 && (
                                        <span className="ml-4 normal-case tracking-normal text-[9px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full animate-bounce flex items-center gap-1">
                                            <MousePointerClick className="h-3 w-3" />
                                            Enable Bulk Mode by selecting items
                                        </span>
                                    )}
                                </th>
                                <th className="p-4">Brand</th>
                                <th className="p-4">SKU / Code</th>
                                <th className="p-4">UOM</th>
                                <th className="p-4 w-48">Stock Level</th>
                                <th className="p-4">Price</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {!products || products.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Package className="h-8 w-8 opacity-40" />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-widest italic opacity-60">Zero nodes found in this sector</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.map((product: any) => (
                                    <tr
                                        key={product.id}
                                        className={`hover:bg-indigo-50/10 transition-all group ${selectedIds.includes(product.id) ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <td className="p-4 text-center">
                                            <Checkbox
                                                checked={selectedIds.includes(product.id)}
                                                onCheckedChange={() => toggleOne(product.id)}
                                                className="h-5 w-5 border-slate-300 dark:border-white/10 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-black text-[10px] border border-transparent group-hover:border-indigo-200 transition-all">
                                                    {(product.name || '??').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <button
                                                        onClick={() => setEditingProduct(product)}
                                                        className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-left text-sm tracking-tight"
                                                    >
                                                        {product.name || 'Unnamed Product'}
                                                    </button>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {product.is_service && <span className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded font-black uppercase tracking-widest border border-amber-100">Service</span>}
                                                        <p className="text-[10px] font-bold text-slate-400 truncate max-w-[150px] uppercase tracking-tighter opacity-70 italic">{product.description || 'Global Registry Item'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-black text-slate-600 uppercase tracking-tighter">{product.brand || 'No Vendor'}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-black text-[10px] text-indigo-500 font-mono bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase italic tracking-widest">{product.sku}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest">{product.uom}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className={`font-black uppercase tracking-widest ${product.stockStatus === 'Low Stock' || product.totalStock === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                        {product.totalStock} {product.uom}
                                                    </span>
                                                    <span className={`text-[8px] font-black uppercase tracking-widest scale-90 ${product.totalStock > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>{product.stockStatus === 'In Stock' ? 'Operational' : product.stockStatus}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${product.totalStock === 0 ? 'bg-slate-300' :
                                                            product.totalStock < 10 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-500'
                                                            }`}
                                                        style={{ width: `${Math.min((Number(product.totalStock) / 50) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-black text-slate-900 font-mono">{currencySymbol}{Number(product.price).toFixed(2)}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingProduct(product)}
                                                    className="h-8 px-4 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 shadow-sm transition-all flex items-center gap-2"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                    Edit
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleDelete(product)}
                                                        className="h-8 px-3 bg-white border-2 border-slate-100 rounded-xl text-slate-400 hover:border-rose-600 hover:text-rose-600 shadow-sm transition-all flex items-center justify-center"
                                                        title="Delete Product (Admin Only)"
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {meta && meta.totalPages > 1 && (
                    <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-slate-50/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sector {meta.page} of {meta.totalPages} • {meta.total?.toLocaleString() || 0} Total Registry Nodes</p>
                        <div className="flex gap-2">
                            <Link
                                href={currentPage > 1 ? `?page=${currentPage - 1}&query=${query || ''}` : '#'}
                                className={`h-8 px-6 flex items-center font-black uppercase text-[9px] tracking-widest border-2 rounded-xl transition-all ${currentPage <= 1 ? 'opacity-30 pointer-events-none' : 'border-slate-200 hover:border-slate-400'}`}
                            >
                                Previous Wave
                            </Link>
                            <Link
                                href={currentPage < meta.totalPages ? `?page=${currentPage + 1}&query=${query || ''}` : '#'}
                                className={`h-8 px-6 flex items-center bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest rounded-xl transition-all ${currentPage >= meta.totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-indigo-600'}`}
                            >
                                Next Wave
                            </Link>
                        </div>
                    </div>
                )}

                {/* WORLD CLASS FLOATING ACTION BAR */}
                <AnimatePresence mode="wait">
                    {selectedIds.length > 0 && !isBulkModalOpen && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none w-full max-w-fit"
                        >
                            <div className="bg-white dark:bg-slate-950 border-2 border-indigo-500 shadow-[0_20px_50px_rgba(79,70,229,0.3)] rounded-[2rem] px-8 py-4 flex items-center gap-8 pointer-events-auto backdrop-blur-xl">
                                <div className="flex items-center gap-3 pr-8 border-r border-slate-200 dark:border-white/10">
                                    <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Layers className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Batch Active</p>
                                        <p className="text-xl font-black text-slate-900 dark:text-white italic tracking-tighter leading-none">{selectedIds.length} Selection</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setIsBulkModalOpen(true)}
                                        className="h-12 px-6 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-xl"
                                    >
                                        <Settings2 className="h-4 w-4" />
                                        Batch Categorize
                                    </Button>
                                    <Button
                                        onClick={() => setSelectedIds([])}
                                        className="h-12 w-12 bg-slate-100 hover:bg-rose-600 text-slate-400 hover:text-white rounded-2xl transition-all flex items-center justify-center group"
                                    >
                                        <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {editingProduct && (
                <EditProductModal
                    isOpen={!!editingProduct}
                    onClose={() => setEditingProduct(null)}
                    product={editingProduct}
                    suppliers={suppliers}
                    taxRates={taxRates}
                    uoms={uoms}
                    categories={categories}
                    manufacturers={manufacturers}
                    uomCategories={uomCategories}
                />
            )}

            {isBulkModalOpen && (
                <BulkEditModal
                    isOpen={isBulkModalOpen}
                    onClose={() => setIsBulkModalOpen(false)}
                    selectedIds={selectedIds}
                    categories={categories}
                    onSuccess={() => setSelectedIds([])}
                />
            )}
        </>
    )
}
