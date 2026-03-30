'use client'

import { useState } from "react"
import Link from "next/link"
import { Package, TrendingUp, TrendingDown } from "lucide-react"
import { EditProductModal } from "./edit-product-modal"

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

    return (
        <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                <th className="p-4 w-12">
                                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                </th>
                                <th className="p-4">Product Info</th>
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
                                            <p>No products found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                products.map((product: any) => (
                                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="p-4">
                                            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">
                                                    {product.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <button 
                                                        onClick={() => setEditingProduct(product)}
                                                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors text-left"
                                                    >
                                                        {product.name}
                                                    </button>
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-gray-600">{product.brand || '-'}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{product.sku}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-medium text-gray-500 uppercase">{product.uom}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs">
                                                    <span className={`font-medium ${product.stockStatus === 'Low Stock' ? 'text-red-600' : 'text-gray-700'}`}>
                                                        {product.totalStock}
                                                    </span>
                                                    <span className="text-gray-400 text-xs scale-90">{product.stockStatus}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${product.totalStock === 0 ? 'bg-gray-300' :
                                                            product.totalStock < 10 ? 'bg-red-500' : 'bg-green-500'
                                                            }`}
                                                        style={{ width: `${Math.min((product.totalStock / 50) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-medium text-gray-900">{meta?.currencySymbol || product.currency || session?.user?.currencySymbol || '₹'} {product.price.toFixed(2)}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => setEditingProduct(product)}
                                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 shadow-sm transition-all"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {meta && meta.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-500">Page {meta.page} of {meta.totalPages}</p>
                        <div className="flex gap-2">
                            <Link
                                href={currentPage > 1 ? `?page=${currentPage - 1}&query=${query || ''}` : '#'}
                                className={`px-3 py-1 text-sm border rounded hover:bg-gray-50 ${currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={currentPage < meta.totalPages ? `?page=${currentPage + 1}&query=${query || ''}` : '#'}
                                className={`px-3 py-1 text-sm border rounded hover:bg-gray-50 ${currentPage >= meta.totalPages ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                Next
                            </Link>
                        </div>
                    </div>
                )}
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
        </>
    )
}
