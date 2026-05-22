
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer, Download, CreditCard, Calendar, User, Building2, Pencil, Plus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvoiceControlPanel } from "@/components/billing/invoice-control-panel";
import { InvoiceReturnClient } from "./invoice-return-client";

export default async function InvoiceDetailsPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ id: string }>,
    searchParams: Promise<{ action?: string }>
}) {
    const session = await auth();
    const { id } = await params;
    const { action } = await searchParams;

    if (!session?.user?.tenantId) return <div>Unauthorized</div>;

    const invoice = await prisma.hms_invoice.findUnique({
        where: {
            id,
            tenant_id: session.user.tenantId
        },
        include: {
            hms_patient: true,
            hms_invoice_lines: {
                include: {
                    hms_product: true
                }
            },
            hms_invoice_payments: true
        }
    });

    if (!invoice) return notFound();

    const company = await prisma.company.findUnique({
        where: { id: invoice.company_id }
    });

    // [INTEGRITY-CHECK] Check for pending nursing items within 24h window
    let pendingConsumablesCount = 0;
    if (invoice.patient_id) {
        const recentAppts = await prisma.hms_appointments.findMany({
            where: {
                patient_id: invoice.patient_id,
                starts_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            select: { id: true }
        });
        const apptIds = recentAppts.map((a: any) => a.id);
        if (apptIds.length > 0) {
            pendingConsumablesCount = await prisma.hms_stock_move.count({
                where: {
                    source_reference: { in: apptIds },
                    source: 'Nursing Consumption (Pending)'
                }
            });
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/hms/billing" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h1>
                        <p className="text-slate-500 text-sm">Created on {new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {invoice.status === 'draft' && (
                        <Link href={`/hms/billing/${invoice.id}/edit`}>
                            <Button variant="outline" size="sm">
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </Button>
                        </Link>
                    )}
                    <InvoiceReturnClient
                        invoiceId={invoice.id}
                        patientId={invoice.hms_patient?.id || ''}
                        patientName={`${invoice.hms_patient?.first_name || 'Guest'} ${invoice.hms_patient?.last_name || ''}`}
                        items={JSON.parse(JSON.stringify(invoice.hms_invoice_lines))}
                        autoOpen={action === 'return'}
                    />
                    <Link href={invoice.hms_patient?.id ? `/hms/billing/new?patientId=${invoice.hms_patient.id}` : '/hms/billing/new'}>
                        <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" /> New Bill
                        </Button>
                    </Link>
                    <InvoiceControlPanel
                        invoiceId={invoice.id}
                        currentStatus={invoice.status || 'draft'}
                        outstandingAmount={Number(invoice.outstanding_amount || 0)}
                        patientEmail={(invoice.hms_patient?.contact as any)?.email}
                        invoiceData={JSON.parse(JSON.stringify({ ...invoice, company: company }))} // Pass serialized data
                        pendingConsumablesCount={pendingConsumablesCount}
                    />
                </div>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-lg flex items-center justify-between ${
                invoice.status === 'paid' ? 'bg-green-50 text-green-700 border border-green-100' :
                invoice.status === 'posted' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                invoice.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-slate-50 text-slate-700 border border-slate-200'
            }`}>
                <div className="flex items-center gap-3">
                    {invoice.status === 'cancelled' ? <AlertTriangle className="h-5 w-5 text-red-500" /> : (
                        <div className={`h-2 w-2 rounded-full ${
                            invoice.status === 'paid' ? 'bg-green-500' :
                            invoice.status === 'posted' ? 'bg-blue-500' : 
                            'bg-slate-500'
                        }`} />
                    )}
                    <span className="font-bold uppercase tracking-wide">
                        {invoice.status === 'cancelled' ? 'VOIDED / CANCELLED' : invoice.status}
                    </span>
                </div>
                <div className="font-mono font-black text-xl">
                    {invoice.status === 'cancelled' ? (
                        <span className="text-slate-400 line-through">Outstanding: ₹{Number(invoice.outstanding_amount || 0).toFixed(2)}</span>
                    ) : (
                        `Outstanding: ₹${Number(invoice.outstanding_amount || 0).toFixed(2)}`
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Patient Info */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <User className="h-4 w-4" /> Bill To
                    </h3>
                    {invoice.hms_patient ? (
                        <div className="space-y-1">
                            <div className="font-medium text-lg text-slate-900">
                                {invoice.hms_patient.first_name} {invoice.hms_patient.last_name}
                            </div>
                            <div className="text-slate-500 text-sm">{invoice.hms_patient.patient_number}</div>
                        </div>
                    ) : (() => {
                        const m = invoice.billing_metadata;
                        const bMeta = typeof m === 'string' ? (JSON.parse(m || '{}')) : (m || {});
                        const walkInName = bMeta.patient_name || bMeta.name || bMeta.customer_name || (invoice as any).patient_name;
                        const walkInPhone = bMeta.patient_phone || bMeta.phone || bMeta.mobile || (invoice as any).patient_phone;
                        
                        return walkInName ? (
                            <div className="space-y-1">
                                <div className="font-medium text-lg text-slate-900">{walkInName}</div>
                                {walkInPhone && <div className="text-slate-500 text-sm">{walkInPhone}</div>}
                                <div className="text-[10px] text-pink-500 font-black uppercase tracking-widest bg-pink-50 w-fit px-2 py-0.5 rounded-md mt-1">Walk-in Guest</div>
                            </div>
                        ) : (
                            <div className="text-slate-400 italic">Guest Patient</div>
                        );
                    })()}
                </div>

                {/* Invoice Meta */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Details
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Invoice Date</span>
                            <span className="font-medium">{invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Due Date</span>
                            <span className="font-medium">{invoice.due_at ? new Date(invoice.due_at).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Currency</span>
                            <span className="font-medium">{invoice.currency}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500">Item</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">Qty</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">Price</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoice.hms_invoice_lines.map((line) => (
                            <tr key={line.id}>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{(line as any).hms_product?.name || line.description || 'Item'}</div>
                                    {line.description && line.description !== 'Auto-created from invoice scan' && line.description !== (line as any).hms_product?.name && (
                                        <div className="text-xs text-slate-500">{line.description}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600">{Number(line.quantity)}</td>
                                <td className="px-6 py-4 text-right text-slate-600">₹{Number(line.unit_price).toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-medium text-slate-900">₹{Number(line.net_amount).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                            <td colSpan={3} className="px-6 py-3 text-right font-medium text-slate-500">Subtotal</td>
                            <td className="px-6 py-3 text-right font-medium text-slate-900">₹{Number(invoice.subtotal).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="px-6 py-3 text-right font-medium text-slate-500">Tax</td>
                            <td className="px-6 py-3 text-right font-medium text-slate-900">₹{Number(invoice.total_tax).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="px-6 py-3 text-right font-bold text-slate-900 text-lg">Total</td>
                            <td className="px-6 py-3 text-right font-bold text-slate-900 text-lg">₹{Number(invoice.total).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}
