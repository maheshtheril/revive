import { getProductsPremium, getSuppliers, getTaxRates, getUOMs, getCategories, getManufacturers, getUOMCategories } from "@/app/actions/inventory"
import { auth } from "@/auth"
import Link from "next/link"
import {
    Search,
    Filter,
    Package,
} from "lucide-react"
import { CreateProductModal } from "@/components/inventory/create-product-modal"
import { ImportProductModal } from "@/components/inventory/import-product-modal"
import { ProductTableClient } from "@/components/inventory/product-table-client"
import { Suspense } from "react"

export default async function ProductListPage({
    searchParams
}: {
    searchParams: Promise<{ query?: string; page?: string; import?: string }>
}) {
    const { query, page, import: importMode } = await searchParams;
    const currentPage = Number(page) || 1;
    const autoOpenImport = importMode === 'true';

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Registry</h1>
                    <p className="text-sm text-gray-500">Manage your catalog, stock levels, and pricing.</p>
                </div>
                <div className="flex gap-3">
                    <ImportProductModal defaultOpen={autoOpenImport} />
                    <Suspense fallback={
                        <div className="px-4 py-2 bg-gray-100 rounded-lg animate-pulse w-32 h-10 border border-gray-200"></div>
                    }>
                        <CreateProductActions />
                    </Suspense>
                </div>
            </div>

            {/* Smart Stats Summary */}
            <Suspense fallback={<div className="h-24 bg-gray-50 animate-pulse rounded-2xl"></div>}>
                <ProductStatsSummary query={query} />
            </Suspense>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <form action="">
                        <input
                            name="query"
                            defaultValue={query}
                            placeholder="Data search (Name, SKU, Barcode)..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </form>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filter
                    </button>
                    {/* View Options could go here */}
                </div>
            </div>

            {/* Smart Table streaming in */}
            <Suspense fallback={<TableSkeleton />}>
                <ProductTable query={query} currentPage={currentPage} />
            </Suspense>
        </div>
    )
}

// ----------------------------------------------------
// Server Component: Fetches Modals Data independently
// ----------------------------------------------------
async function CreateProductActions() {
    const [
        suppliers,
        taxRates,
        uoms,
        categories,
        manufacturers,
        uomCategories
    ] = await Promise.all([
        getSuppliers(),
        getTaxRates(),
        getUOMs(),
        getCategories(),
        getManufacturers(),
        getUOMCategories()
    ]);

    return (
        <CreateProductModal
            suppliers={suppliers}
            taxRates={taxRates}
            uoms={uoms}
            categories={categories}
            manufacturers={manufacturers}
            uomCategories={uomCategories}
        />
    )
}

// ----------------------------------------------------
// Server Component: Fetches Table Data independently
// ----------------------------------------------------
async function ProductTable({ query, currentPage }: { query?: string, currentPage: number }) {
    const session = await auth();
    const { data: products, meta } = await getProductsPremium(query, currentPage);

    const [
        suppliers,
        taxRates,
        uoms,
        categories,
        manufacturers,
        uomCategories
    ] = await Promise.all([
        getSuppliers(),
        getTaxRates(),
        getUOMs(),
        getCategories(),
        getManufacturers(),
        getUOMCategories()
    ]);

    return (
        <ProductTableClient
            products={products || []}
            meta={meta}
            session={session}
            suppliers={suppliers}
            taxRates={taxRates}
            uoms={uoms}
            categories={categories}
            manufacturers={manufacturers}
            uomCategories={uomCategories}
            query={query}
            currentPage={currentPage}
        />
    )
}

// ----------------------------------------------------
// Server Component: Fetches Stats independently
// ----------------------------------------------------
async function ProductStatsSummary({ query }: { query?: string }) {
    const { meta } = await getProductsPremium(query, 1);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md transition-all">
                <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Package className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Products</p>
                    <h3 className="text-2xl font-black text-slate-900">{meta.total?.toLocaleString() || 0} Nodes</h3>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md transition-all">
                <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                    <Filter className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Results</p>
                    <h3 className="text-2xl font-black text-slate-900">{query ? 'Filtered' : 'Global'} View</h3>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:shadow-md transition-all">
                <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Search className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sector Page</p>
                    <h3 className="text-2xl font-black text-slate-900">{meta.page} of {meta.totalPages}</h3>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// UI Skeleton for Loading states
// ----------------------------------------------------
function TableSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="divide-y divide-gray-50">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 flex items-center gap-6">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg animate-pulse shrink-0"></div>
                        <div className="space-y-2 flex-1">
                            <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse shrink-0"></div>
                        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse shrink-0"></div>
                    </div>
                ))}
            </div>
        </div>
    )
}
