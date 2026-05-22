import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, TrendingUp, AlertCircle, CheckCircle2, Search, FileText, Clock, Receipt } from "lucide-react"
import { auth } from "@/auth"
// hms_invoice_status refactored to string 

import SearchInput from "@/components/search-input"
import { BillingActions } from "@/components/billing/billing-actions"
import { BillingDateRangeFilter } from "@/components/billing/billing-date-range-filter"
import { BillingMethodFilter } from "@/components/billing/billing-method-filter"

export default async function BillingPage({
    searchParams
}: {
    searchParams: Promise<{
        q?: string
        status?: string
        from?: string
        to?: string
        method?: string
    }>
}) {
    const session = await auth();
    if (!session?.user?.companyId) return <div>Unauthorized</div>;

    const { q, status, from, to, method } = await searchParams;
    const query = q || ''
    const currentStatus = status || 'all'
    const methodQuery = method || null;

    // World-Standard Date Range Filter Logic: Default to Today unless 'all' is explicitly requested
    const todayStr = new Date().toISOString().split('T')[0];
    const rawFrom = from ?? todayStr;
    const rawTo = to ?? todayStr;
    const fromQuery = rawFrom === 'all' ? null : rawFrom;
    const toQuery = rawTo === 'all' ? null : rawTo;

    // Status filter logic
    const statusFilter: any = currentStatus !== 'all' ? { status: currentStatus } : {}

    // Payment Method Filter Logic: Support for granular financial tracking
    const methodFilter: any = methodQuery ? {
        hms_invoice_payments: {
            some: {
                method: methodQuery as any
            }
        }
    } : {};

    // World-Standard Date Range Filter Logic: Handling From/To Periods
    const dateFilter: any = (fromQuery || toQuery) ? {
        invoice_date: {
            gte: fromQuery ? new Date(`${fromQuery}T00:00:00.000Z`) : undefined,
            lte: toQuery ? new Date(`${toQuery}T23:59:59.999Z`) : undefined
        }
    } : {};

    const isAdmin = session?.user?.isAdmin || (session?.user as any)?.isTenantAdmin;

    // Parallel fetch for stats and list
    const [invoices, stats, draftCount, methodSpecificRevenue] = await Promise.all([
        prisma.hms_invoice.findMany({
            orderBy: { created_at: 'desc' }, // Use created_at to see newest drafts first
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                ...(!isAdmin && { created_by: session.user.id }),
                ...statusFilter,
                ...dateFilter,
                ...methodFilter,
                OR: query ? [
                    { invoice_number: { contains: query, mode: 'insensitive' } },
                    {
                        hms_patient: {
                            OR: [
                                { first_name: { contains: query, mode: 'insensitive' } },
                                { last_name: { contains: query, mode: 'insensitive' } }
                            ]
                        }
                    }
                ] : undefined
            },
            include: {
                hms_patient: true
            },
            take: 100 // Increased limit to see more
        }),
        prisma.hms_invoice.aggregate({
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                ...(!isAdmin && { created_by: session.user.id }),
                status: { not: 'cancelled' },
                ...statusFilter,
                ...dateFilter,
                ...methodFilter
            },
            _sum: {
                total: true, // Total Billed
                outstanding_amount: true, // Total Due
                total_paid: true // Total Collected
            },
            _count: {
                id: true
            }
        }),
        // Explicit count for drafts to show badge if needed
        prisma.hms_invoice.count({
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                ...(!isAdmin && { created_by: session.user.id }),
                status: 'draft' as any,
                ...dateFilter,
                ...methodFilter
            }
        }),
        // [WORLD-CLASS] Precision Revenue Calculation: When filtering by method, sum payments directly
        methodQuery ? prisma.hms_invoice_payments.aggregate({
            where: {
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                method: methodQuery as any,
                hms_invoice: {
                    ...(!isAdmin && { created_by: session.user.id }),
                    ...dateFilter,
                    company_id: session.user.companyId,
                    status: { not: 'cancelled' }
                }
            },
            _sum: { amount: true }
        }) : Promise.resolve(null)
    ]);

    // If method is selected, Total Revenue = Sum of payments of that method
    // If NO method selected, Total Revenue = Sum(total_paid) of filtered invoices
    const totalRevenue = methodQuery 
        ? (methodSpecificRevenue?._sum.amount?.toNumber() || 0)
        : (stats._sum.total_paid?.toNumber() || 0);
    
    const totalOutstanding = stats._sum.outstanding_amount?.toNumber() || 0;
    const totalBilled = stats._sum.total?.toNumber() || 0;

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Billing & Finance</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage invoices, track revenue, and handle billing operations.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/hms/billing/returns" className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm font-bold text-sm hover:text-indigo-600 hover:border-indigo-200">
                        Credit Notes
                    </Link>
                    <Link href="/hms/billing/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 font-bold text-sm active:scale-95">
                        <Plus className="h-4 w-4" />
                        Create Invoice
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-20 w-20 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">₹{totalRevenue.toLocaleString('en-IN')}</h3>
                        <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <CheckCircle2 className="h-3 w-3" />
                            Collected
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircle className="h-20 w-20 text-orange-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">₹{totalOutstanding.toLocaleString('en-IN')}</h3>
                        <p className="text-xs text-orange-600 mt-2 font-bold flex items-center gap-1 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                            <Clock className="h-3 w-3" />
                            Pending Collection
                        </p>
                    </div>
                </div>

                <Link href="?status=draft" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between relative overflow-hidden group hover:border-indigo-200 transition-colors cursor-pointer ring-offset-2 focus:ring-2 ring-indigo-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="h-20 w-20 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Draft Invoices</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{draftCount}</h3>
                        <p className="text-xs text-indigo-600 mt-2 font-bold flex items-center gap-1 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                            <FileText className="h-3 w-3" />
                            Needs Attention
                        </p>
                    </div>
                </Link>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-slate-50 p-1.5 rounded-2xl">
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                    <Link
                        href="?status=all"
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentStatus === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        All
                    </Link>
                    <Link
                        href="?status=draft"
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${currentStatus === 'draft' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        Drafts
                        {draftCount > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${currentStatus === 'draft' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftCount}</span>}
                    </Link>
                    <Link
                        href="?status=posted"
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentStatus === 'posted' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        Unpaid
                    </Link>
                    <Link
                        href="?status=paid"
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentStatus === 'paid' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        Paid
                    </Link>
                </div>

                <div className="flex-1 flex justify-center gap-3 px-4">
                    <BillingDateRangeFilter />
                    <BillingMethodFilter />
                </div>

                <div className="w-full md:w-auto relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <SearchInput placeholder="Search invoice..." className="pl-10 w-full md:w-80 bg-white border-slate-200 focus:border-indigo-500 rounded-xl" />
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider">Invoice</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider">Patient</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider text-right">Bill Amt</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider text-right">Collected</th>
                            <th className="p-5 font-bold text-xs text-slate-500 uppercase tracking-wider text-right w-[100px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-20 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <Receipt className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-slate-900 font-bold text-lg mb-1">No invoices found</h3>
                                        <p className="text-slate-500 mb-6 max-w-xs mx-auto text-sm">
                                            {status === 'draft' ? "Great job! All draft invoices have been processed." : "Try adjusting your search or filters."}
                                        </p>
                                        <Link href="/hms/billing/new" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                                            Create Invoice
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-5 text-slate-900 font-black font-mono text-sm">
                                        <Link href={`/hms/billing/${inv.id}`} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                            <Receipt className="h-4 w-4 text-slate-300 group-hover:text-indigo-300" />
                                            {inv.invoice_number || 'DRAFT'}
                                        </Link>
                                    </td>
                                    <td className="p-5">
                                        {inv.hms_patient ? (
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm ${
                                                    inv.hms_patient.gender === 'male' ? 'bg-blue-100 text-blue-700' :
                                                    inv.hms_patient.gender === 'female' ? 'bg-pink-100 text-pink-700' : 
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {inv.hms_patient.first_name?.[0] || 'P'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{inv.hms_patient.first_name} {inv.hms_patient.last_name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{inv.hms_patient.patient_number}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm bg-slate-100 text-slate-700 uppercase">
                                                    G
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">Guest / Walk-in</p>
                                                    <p className="text-[10px] text-pink-500 font-black uppercase tracking-widest">Unregistered</p>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5 text-slate-500 text-sm font-medium">
                                        {(inv.invoice_date || inv.created_at) ? new Date(inv.invoice_date || inv.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold capitalize border inline-flex items-center gap-1.5
                                            ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                inv.status === 'posted' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-500' :
                                                inv.status === 'posted' ? 'bg-blue-500' : 'bg-slate-400'
                                                }`}></span>
                                            {inv.status || 'draft'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right font-mono text-sm font-bold text-slate-400">
                                        ₹{Number(inv.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-5 text-right font-mono text-sm font-black text-emerald-600">
                                        {inv.status === 'cancelled' ? (
                                            <span className="text-slate-400 line-through decoration-red-400">₹{Number(inv.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        ) : (
                                            `₹${Number(inv.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        )}
                                    </td>
                                    <td className="p-5 text-right">
                                        <BillingActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {invoices.length > 0 && (
                        <tfoot className="bg-slate-50/50 border-t border-slate-100">
                            <tr>
                                <td colSpan={4} className="p-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">
                                    Total for visible records
                                </td>
                                <td className="p-5 text-right font-black text-slate-400 text-sm tracking-tight">
                                    ₹{invoices.reduce((sum, inv) => sum + (inv.status === 'cancelled' ? 0 : Number(inv.total || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-5 text-right font-black text-emerald-600 text-lg tracking-tight">
                                    ₹{invoices.reduce((sum, inv) => sum + (inv.status === 'cancelled' ? 0 : Number(inv.total_paid || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}
