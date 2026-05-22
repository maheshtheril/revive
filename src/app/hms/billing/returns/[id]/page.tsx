
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer, Download, CreditCard, Calendar, User, FileText, ExternalLink, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function SalesReturnDetailsPage({ 
    params 
}: { 
    params: Promise<{ id: string }>
}) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.tenantId) return <div>Unauthorized</div>;

    const sReturn = await prisma.hms_sales_return.findUnique({
        where: {
            id,
            tenant_id: session.user.tenantId
        },
        include: {
            hms_patient: true,
            hms_invoice: true,
            lines: {
                include: {
                    hms_product: true
                }
            }
        }
    });

    if (!sReturn) return notFound();

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/hms/billing/returns" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900">{sReturn.return_number}</h1>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-md tracking-widest">Credit Note</span>
                        </div>
                        <p className="text-slate-500 text-sm">Processed on {new Date(sReturn.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/hms/billing/returns/${sReturn.id}/edit`}>
                        <Button variant="outline" className="border-emerald-200 hover:bg-emerald-50 text-emerald-600">
                            <Edit className="h-4 w-4 mr-2" /> Edit Return
                        </Button>
                    </Link>
                    <Link href={`/api/return-printer/${sReturn.id}?autoPrint=true`} target="_blank">
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100">
                            <Printer className="h-4 w-4 mr-2" /> Print Credit Note
                        </Button>
                    </Link>
                    <Link href={`/api/return-printer/${sReturn.id}`} target="_blank">
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" /> Download PDF
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Against Bill Link */}
            {sReturn.hms_invoice && (
                <Link href={`/hms/billing/${sReturn.hms_invoice.id}`}>
                    <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between group hover:bg-slate-800 transition-all cursor-pointer border border-white/10 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <FileText className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Linked Document</p>
                                <p className="font-bold">Against Bill: {sReturn.hms_invoice.invoice_number}</p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-white/20 group-hover:text-white transition-colors" />
                    </div>
                </Link>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Patient Info */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <User className="h-3 w-3" /> Patient Identity
                    </h3>
                    {sReturn.hms_patient ? (
                        <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-900">
                                {sReturn.hms_patient.first_name} {sReturn.hms_patient.last_name}
                            </div>
                            <div className="text-slate-500 text-sm">{sReturn.hms_patient.patient_number}</div>
                        </div>
                    ) : (
                        <div className="text-slate-400 italic">Walk-in Patient</div>
                    )}
                </div>

                {/* Return Details */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> Transaction Intel
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Return Reason</span>
                            <span className="font-bold text-slate-900">{sReturn.reason || "Standard Sales Return"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Refund Method</span>
                            <span className="font-bold text-emerald-600 uppercase">{(sReturn.metadata as any)?.refund_method || "Credit Note"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Unit Price</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Reversed Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                        {sReturn.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900">{line.hms_product?.name || "Product"}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{(line.metadata as any)?.batch_id?.slice(0,8) || "NO-BATCH"}</div>
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600 font-mono">{Number(line.qty)}</td>
                                <td className="px-6 py-4 text-right text-slate-600 font-mono">₹{Number(line.unit_price).toFixed(2)}</td>
                                <td className="px-6 py-4 text-right text-slate-900 font-bold font-mono">₹{Number(line.line_total).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80">
                        <tr>
                            <td colSpan={3} className="px-6 py-6 text-right font-black text-slate-500 uppercase tracking-widest text-[10px]">Total Refund Amount</td>
                            <td className="px-6 py-6 text-right text-xl font-black text-emerald-600 font-mono">₹{Number(sReturn.total_amount).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Audit Note */}
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Institutional Credit Note Node • Audited Workflow</p>
            </div>
        </div>
    )
}
