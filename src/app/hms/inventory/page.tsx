import { getInventoryDashboardStats } from "@/app/actions/inventory"
import { getCompanyDefaultCurrency } from "@/app/actions/currency"
import { formatCurrency } from "@/lib/currency"
import Link from "next/link"
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Activity,
    Plus,
    Search,
    ArrowRight,
    Box,
    DollarSign,
    RefreshCw,
    QrCode
} from "lucide-react"
import { StockAdjustmentButton } from "./stock-adjustment-button"
import { SyncHealthIndicator } from "@/components/infra/sync-health"

export default async function InventoryDashboard() {
    const defaultCurrency = await getCompanyDefaultCurrency();
    const statsRes = await getInventoryDashboardStats();
    const stats = statsRes.success && statsRes.data ? statsRes.data : {
        totalProducts: 0,
        lowStockCount: 0,
        totalValue: 0,
        recentMoves: []
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header with Glassmorphism feel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-gray-900 to-gray-800 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                {/* Decorative background blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Inventory Overview</h1>
                        <p className="text-gray-400 mt-2 text-lg">Real-time stock intelligence and control.</p>
                    </div>
                    <SyncHealthIndicator />
                </div>
                <div className="flex flex-wrap gap-3 relative z-10">
                    <Link
                        href="/hms/inventory/products/new"
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Add Product
                    </Link>
                    <Link
                        href="/hms/inventory/products"
                        className="px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl font-semibold border border-white/10 transition-all flex items-center gap-2"
                    >
                        <Box className="h-5 w-5" />
                        Manage Stock
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Products */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Package className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Active</span>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
                        <p className="text-sm text-gray-500 font-medium mt-1">Total Products</p>
                    </div>
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
                    {stats.lowStockCount > 0 && (
                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full -mr-8 -mt-8"></div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        {stats.lowStockCount > 0 && (
                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">Action Needed</span>
                        )}
                    </div>
                    <div>
                        <p className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.lowStockCount}</p>
                        <p className="text-sm text-gray-500 font-medium mt-1">Low Stock Alerts</p>
                    </div>
                </div>

                {/* Inventory Value */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition-transform">
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Estimate
                        </span>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-gray-900">
                            {formatCurrency(stats.totalValue, defaultCurrency.code)}
                        </p>
                        <p className="text-sm text-gray-500 font-medium mt-1">Total Valuation</p>
                    </div>
                </div>

                {/* Recent Activity Count (Placeholder for now) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Activity className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Last 24h</span>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-gray-900">{stats.recentMoves.length}</p>
                        <p className="text-sm text-gray-500 font-medium mt-1">Recent Movements</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Interaction Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Access Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Box className="h-5 w-5 text-blue-600" />
                            Inventory Operations
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <Link href="/hms/inventory/products" className="p-4 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-100 transition-all group text-center flex flex-col items-center gap-3">
                                <div className="p-3 bg-white rounded-full shadow-sm text-gray-600 group-hover:text-blue-600 group-hover:scale-110 transition-all">
                                    <Search className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Product Lookup</span>
                            </Link>
                            <Link href="/hms/purchasing/receipts/new" className="p-4 rounded-xl bg-gray-50 hover:bg-green-50 border border-gray-100 hover:border-green-100 transition-all group text-center flex flex-col items-center gap-3">
                                <div className="p-3 bg-white rounded-full shadow-sm text-gray-600 group-hover:text-green-600 group-hover:scale-110 transition-all">
                                    <ArrowRight className="h-5 w-5 rotate-90" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-green-700">Receive Stock</span>
                            </Link>
                            <Link href="/hms/inventory/audit" className="p-4 rounded-xl bg-gray-50 hover:bg-purple-50 border border-gray-100 hover:border-purple-100 transition-all group text-center flex flex-col items-center gap-3">
                                <div className="p-3 bg-white rounded-full shadow-sm text-gray-600 group-hover:text-purple-600 group-hover:scale-110 transition-all">
                                    <QrCode className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-purple-700">Mobile Audit</span>
                            </Link>
                            <StockAdjustmentButton />
                            {/* Add more quick links */}
                        </div>
                    </div>

                    {/* Recent Movements Feed */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">Recent Movements</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {stats.recentMoves.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">
                                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p>No recent stock movements recorded.</p>
                                </div>
                            ) : (
                                stats.recentMoves.map((move: any) => (
                                    <div key={move.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${move.type === 'in' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {move.type === 'in' ? <ArrowRight className="h-4 w-4 rotate-180" /> : <ArrowRight className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800">{move.product}</p>
                                                <p className="text-xs text-gray-500">{new Date(move.date).toLocaleDateString()} • {move.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${move.type === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {move.type === 'in' ? '+' : '-'}{move.friendlyQty || move.qty}
                                            </p>
                                            <p className="text-xs text-gray-400">Qty</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Rail: Alerts & Insights */}
                <div className="space-y-6">
                    {/* Low Stock Alert Box */}
                    <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                        <h3 className="text-red-800 font-bold flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-5 w-5" />
                            Stock Attention
                        </h3>
                        <div className="space-y-3">
                            <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-red-500">
                                <div>
                                    <p className="font-semibold text-gray-800">Low Stock Items</p>
                                    <p className="text-xs text-gray-500">{stats.lowStockCount} items below threshold</p>
                                </div>
                                <Link href="/hms/inventory/products?filter=low_stock" className="text-xs font-bold text-red-600 hover:underline">
                                    View All
                                </Link>
                            </div>
                            {/* Placeholder for expiring items */}
                            <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-orange-400 opacity-60">
                                <div>
                                    <p className="font-semibold text-gray-800">Expiring Soon</p>
                                    <p className="text-xs text-gray-500">0 items expiring in 30 days</p>
                                </div>
                                <button disabled className="text-xs font-bold text-orange-600 cursor-not-allowed">
                                    Inspect
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pro Tip / Insight */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                <TrendingUp className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Inventory Insight</h3>
                                <p className="text-indigo-100 text-sm mt-1 leading-relaxed">
                                    Your inventory value has increased by 0% this month. Consider auditing low-turnover stock to free up capital.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
