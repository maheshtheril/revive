
import { getStockMoves } from "@/app/actions/inventory"
import Link from "next/link"
import { Search, Filter, Calendar, ArrowLeft, ArrowRight, Download } from "lucide-react"
import { ProductSearchClient } from "./product-search"

export default async function StockMovesPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ q?: string; page?: string; from?: string; to?: string; type?: string }> 
}) {
    const params = await searchParams;
    const query = params.q || '';
    const page = Number(params.page) || 1;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = params.from || today;
    const toDate = params.to || today;
    const type = params.type || 'ALL';

    const result = await getStockMoves(query, page, { fromDate, toDate, type });
    const moves = result.success ? result.data : [];
    const meta = (result as any).meta || { total: 0, totalPages: 1 };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 leading-none mb-3 italic">STOCK<br />HISTORY.</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Inventory Ledger / Movement Logs</p>
                </div>
                <div className="flex gap-3">
                     <button className="bg-gray-50 text-gray-400 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-100 shadow-sm">
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filter Bar - Modern Sticky */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50">
                <form className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <ProductSearchClient initialQuery={query} />

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">From Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            <input
                                type="date"
                                name="from"
                                defaultValue={fromDate}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">To Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            <input
                                type="date"
                                name="to"
                                defaultValue={toDate}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Movement Type</label>
                        <select
                            name="type"
                            defaultValue={type}
                            className="w-full px-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none appearance-none cursor-pointer"
                        >
                            <option value="ALL">ALL MOVEMENTS</option>
                            <option value="IN">IN (STOCK IN / RECEIPT)</option>
                            <option value="OUT">OUT (STOCK OUT / SALE)</option>
                            <option value="RECEIPT">ONLY RECEIPTS</option>
                            <option value="SALE">ONLY SALES</option>
                            <option value="ADJUSTMENT">ONLY ADJUSTMENTS</option>
                            <option value="RETURN">ONLY RETURNS</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all shadow-lg shadow-gray-200">
                            Apply Filters
                        </button>
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div className="bg-white rounded-[2rem] shadow-2xl shadow-gray-100 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/30 border-b border-gray-100">
                                <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Date / Time</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Intelligence</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-40 text-center">Operation</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Movement Qty</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Ledger Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {moves && moves.length > 0 ? (
                                moves.map((move: any) => (
                                    <tr key={move.id} className="hover:bg-gray-50/50 transition-all group">
                                        <td className="px-8 py-6 whitespace-nowrap text-[11px] font-bold text-gray-500 font-mono italic">
                                            {/* Forced European Format */}
                                            {new Date(move.date).toLocaleDateString('en-GB')}<br />
                                            <span className="opacity-40">{new Date(move.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-black text-gray-900 tracking-tight text-lg leading-tight uppercase group-hover:text-blue-600 transition-colors">
                                                {move.productName || 'Unknown Product'}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 font-mono tracking-widest flex items-center gap-2 mt-1 uppercase">
                                                <span className="bg-gray-100 px-1 rounded">SKU: {move.sku || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {(() => {
                                                const t = (move.type || '').toLowerCase();
                                                let label = move.type || 'UNKNOWN';
                                                let style = 'bg-gray-50 text-gray-500 border-gray-100';
                                                
                                                if (t.includes('in') || t.includes('receipt') || t === 'sale_return') {
                                                    label = t.includes('receipt') ? 'PURCHASE' : (t === 'sale_return' ? 'SALES RETURN' : 'STOCK IN');
                                                    style = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                                } else if (t.includes('out') || t.includes('sale') || t === 'purchase_return') {
                                                    label = t.includes('sale') ? 'SALE' : (t === 'purchase_return' ? 'PURCHASE RETURN' : 'STOCK OUT');
                                                    style = 'bg-rose-50 text-rose-600 border-rose-100';
                                                } else if (t.includes('adjustment')) {
                                                    label = 'ADJUSTMENT';
                                                    style = 'bg-amber-50 text-amber-600 border-amber-100';
                                                }

                                                return (
                                                    <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style}`}>
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className={`text-xl font-black tabular-nums tracking-tighter ${
                                                move.qty > 0 ? 'text-emerald-500' : 'text-slate-900'
                                            }`}>
                                                {move.qty > 0 ? '+' : ''}{move.qty}
                                            </div>
                                            <div className="text-[9px] font-black text-gray-300 uppercase tracking-wider">{move.uom}</div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="text-[11px] font-bold text-gray-500 font-mono bg-gray-50 inline-block px-3 py-1 rounded-lg border border-gray-100 truncate max-w-[200px]">
                                                {move.reference || 'SYSTEM_AUTO'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="p-10 bg-gray-50 rounded-full border border-dashed border-gray-200">
                                                 <Filter className="h-12 w-12 text-gray-200" />
                                            </div>
                                            <p className="text-xl font-black text-gray-300 uppercase italic tracking-widest">No matching history found.</p>
                                            <Link href="/hms/inventory/moves" className="text-xs font-black text-blue-500 uppercase tracking-widest hover:underline pb-1">Reset All Filters</Link>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {meta.totalPages > 1 && (
                    <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Page {meta.page} / {meta.totalPages} (Total {meta.total} moves)
                        </p>
                        <div className="flex gap-2">
                            <Link
                                href={`?page=${page - 1}&q=${query}&from=${fromDate}&to=${toDate}&type=${type}`}
                                className={`p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all ${page <= 1 ? 'opacity-30 pointer-events-none' : 'shadow-sm'}`}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                            <Link
                                href={`?page=${page + 1}&q=${query}&from=${fromDate}&to=${toDate}&type=${type}`}
                                className={`p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all ${page >= meta.totalPages ? 'opacity-30 pointer-events-none' : 'shadow-sm'}`}
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
