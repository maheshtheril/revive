import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { PremiumPrintWrapper } from "@/components/print/premium-print-wrapper"
import { PremiumPrintHeader } from "@/components/print/premium-print-header"
import { PremiumPrintFooter } from "@/components/print/premium-print-footer"
import { getCurrentCompany } from "@/app/actions/company"
import { Printer } from "lucide-react"
import { InvoiceControlPanel } from "@/components/billing/invoice-control-panel"

import { getHMSSettings, getPDFSettings } from "@/app/actions/settings"

export default async function PrintPage({ params, searchParams }: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await auth();
    const { id } = await params;
    const { type, action, mode } = await searchParams;

    if (!session?.user?.companyId) return <div>Unauthorized</div>;

    const companyData = await getCurrentCompany();
    if (!companyData) return <div>Company configuration not found</div>;

    const hmsSettingsRes = await getHMSSettings();
    const hmsSettings = hmsSettingsRes.success ? hmsSettingsRes.settings : null;
    
    // Support manual override 'mode' from URL, otherwise fallback to decoupled settings
    const isPrescription = type === 'prescription';
    
    let printMode: 'standard' | 'letterhead' = 'standard';
    if (mode === 'letterhead' || mode === 'standard') {
        printMode = mode as 'standard' | 'letterhead';
    } else {
        // Fallback to settings
        printMode = isPrescription 
            ? (hmsSettings?.opSlipPreprintedLetterhead ? 'letterhead' : 'standard')
            : (hmsSettings?.billPreprintedLetterhead ? 'letterhead' : 'standard');
    }

    const headerHeight = isPrescription 
        ? (hmsSettings?.opSlipHeaderHeight || '4.5')
        : (hmsSettings?.billHeaderHeight || '4.5');

    // --- Prescription Print View ---
    if (type === 'prescription') {
        const prescription = await (prisma.prescription as any).findFirst({
            where: { id },
            include: {
                hms_patient: true,
                prescription_items: {
                    include: { hms_product: true }
                }
            }
        });

        if (!prescription) return notFound();

        return (
            <PremiumPrintWrapper printMode={printMode} headerHeight={headerHeight}>
                <PremiumPrintHeader
                    company={companyData as any}
                    title="PRESCRIPTION"
                    subtitle="Clinical EMR Record"
                    documentNumber={prescription.id.substring(0, 8).toUpperCase()}
                    hide={printMode === 'letterhead'}
                />

                <div className="flex-1">
                    {/* Patient Info Card */}
                    <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50 p-8 rounded-2xl border border-slate-100 relative overflow-hidden">
                        <div className="relative z-10 font-sans">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 text-left">Patient Details</p>
                            <p className="text-2xl font-bold text-slate-800 mb-1">Dr. {prescription.hms_patient?.first_name} {prescription.hms_patient?.last_name}</p>
                            <div className="flex gap-4 text-sm font-bold text-slate-600">
                                <span>{prescription.hms_patient?.gender}</span>
                                <span className="text-slate-300">|</span>
                                <span>{prescription.hms_patient?.age ? `${prescription.hms_patient.age} Years` : 'N/A'}</span>
                            </div>
                            <p className="text-xs font-mono text-slate-400 mt-2">UHID: {prescription.hms_patient?.patient_number || 'N/A'}</p>
                        </div>
                        <div className="text-right flex flex-col justify-end relative z-10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1 text-right">Date of Visit</p>
                            <p className="text-xl font-bold text-slate-800">{new Date(prescription.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>

                    {/* Clinical Summary Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                        {prescription.vitals && (
                            <div className="bg-white border-l-4 border-emerald-500 pl-4 py-1">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Clinical Vitals</h3>
                                <p className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-wrap italic">{prescription.vitals}</p>
                            </div>
                        )}
                        {prescription.diagnosis && (
                            <div className="bg-white border-l-4 border-blue-500 pl-4 py-1">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Primary Diagnosis</h3>
                                <p className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{prescription.diagnosis}</p>
                            </div>
                        )}
                    </div>

                    {/* Prescription Table */}
                    <div className="mb-16">
                        <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-300 pb-2">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-[0.15em]">Medication Schedule</h3>
                        </div>
                        <table className="w-full text-left font-sans">
                            <thead>
                                <tr className="border-y-2 border-slate-300 text-[10px] text-slate-800 uppercase tracking-widest font-bold">
                                    <th className="px-6 py-4 text-left">Medicine Name & Formulation</th>
                                    <th className="px-6 py-4 text-left">Dosage Plan</th>
                                    <th className="px-6 py-4 text-left">Duration</th>
                                    <th className="px-6 py-4 text-right">Total Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100 rounded-b-xl">
                                {prescription.prescription_items.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-5">
                                            <p className="font-bold text-base text-slate-800">{item.hms_product?.name || 'Unknown Medicine'}</p>
                                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter italic">Generic: {item.hms_product?.generic_name || 'Pharmacological Grade'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-base font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                                    {item.morning}-{item.afternoon}-{item.evening}-{item.night}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-slate-700">{item.days} <span className="text-slate-400 font-bold uppercase text-[10px]">Days</span></p>
                                        </td>
                                        <td className="px-6 py-5 text-right font-bold text-lg text-slate-800">
                                            {(item.morning + item.afternoon + item.evening + item.night) * item.days}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <PremiumPrintFooter
                    signatureLabel="Consultant In-Charge"
                    note="Follow up is recommended. Please bring this prescription on your next visit. In case of emergency or adverse reaction, please contact the clinic immediately."
                />
            </PremiumPrintWrapper>
        );
    }

    // --- Standard Invoice Print View ---
    const invoice = await prisma.hms_invoice.findUnique({
        where: {
            id,
            company_id: session.user.companyId
        },
        include: {
            hms_patient: true,
            hms_invoice_lines: true,
            hms_invoice_payments: true
        }
    });

    if (!invoice) return notFound();

    return (
        <PremiumPrintWrapper printMode={printMode} headerHeight={headerHeight}>
            {/* Interactive Control Panel (Hidden when printing) */}
            <div className="print:hidden w-full flex items-center justify-between gap-4 mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                        <Printer className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Print Preview Mode</h3>
                        <p className="text-xs text-slate-500">Review the document below before printing.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <InvoiceControlPanel
                        invoiceId={invoice.id}
                        currentStatus={invoice.status || 'draft'}
                        outstandingAmount={Number(invoice.outstanding_amount || 0)}
                        patientEmail={(invoice.hms_patient?.contact as any)?.email}
                        invoiceData={{ ...invoice, company: companyData }}
                        autoOpenPayment={action === 'pay'}
                    />
                </div>
            </div>

            <PremiumPrintHeader
                company={companyData as any}
                title="TAX INVOICE"
                subtitle="Financial Transaction Record"
                documentNumber={invoice.invoice_number}
                hide={printMode === 'letterhead'}
            />

            <div className="flex-1">
                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-12 mb-10 p-2 font-sans">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 text-left">
                            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full text-left"></span> Bill To
                        </h3>
                        <div className="pl-4 border-l-2 border-slate-100">
                            <p className="text-xl font-bold text-slate-800">{invoice.hms_patient?.first_name} {invoice.hms_patient?.last_name}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase mt-1">Patient ID: {invoice.hms_patient?.patient_number || 'N/A'}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase">Contact: {((invoice.hms_patient?.contact as any)?.phone) || 'N/A'}</p>
                            {(() => {
                                const expiry = (invoice.hms_patient?.metadata as any)?.registration_expiry;
                                if (!expiry) return null;
                                const expiryDate = new Date(expiry);
                                const today = new Date();
                                const diffMs = expiryDate.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                const isExpired = diffDays < 0;
                                return (
                                    <p className={`text-xs font-bold uppercase mt-1 ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                                        Reg. Valid Till: {expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        {' '}({isExpired ? `Expired ${Math.abs(diffDays)} days ago` : `${diffDays} days remaining`})
                                    </p>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="space-y-4 text-right">
                        <div className="space-y-1 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex justify-between gap-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Invoice Date:</span>
                                <span className="font-bold text-slate-800 uppercase text-xs text-right">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(invoice.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Payment Status:</span>
                                <span className={`font-bold uppercase text-[10px] text-right ${invoice.status === 'paid' ? 'text-emerald-600' : 'text-slate-600'}`}>
                                    {invoice.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-10 overflow-hidden border-y border-slate-200 font-sans">
                    <table className="w-full text-left">
                        <thead className="border-b border-slate-300 text-[10px] font-bold text-slate-800 uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-6 py-5 text-left">#</th>
                                <th className="px-6 py-5 text-left">Description & Service Category</th>
                                <th className="px-6 py-5 text-right">Qty</th>
                                <th className="px-6 py-5 text-right">Rate</th>
                                <th className="px-6 py-5 text-right">Net Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {invoice.hms_invoice_lines.map((item, idx) => (
                                <tr key={item.id} className="text-slate-700 hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-5 font-bold text-slate-300">{idx + 1}</td>
                                    <td className="px-6 py-5">
                                        <p className="font-bold text-slate-800 text-base">{item.description}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">{item.uom || 'Unit'}</p>
                                    </td>
                                    <td className="px-6 py-5 text-right font-bold">{Number(item.quantity)}</td>
                                    <td className="px-6 py-5 text-right font-medium text-slate-500">₹{Number(item.unit_price).toFixed(2)}</td>
                                    <td className="px-6 py-5 text-right font-bold text-slate-800 text-base">₹{Number(item.net_amount).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end mt-12 mb-16 font-sans">
                    <div className="w-80 space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span className="text-left">Subtotal</span>
                            <span className="text-slate-800 font-bold text-right">₹{Number(invoice.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span className="text-left">Tax Assessment</span>
                            <span className="text-indigo-600 font-bold text-right">₹{Number(invoice.total_tax).toFixed(2)}</span>
                        </div>

                        <div className="pt-4 border-t border-slate-300">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-slate-800 uppercase tracking-tighter text-left">Grand Total</span>
                                <span className="text-3xl font-bold text-slate-800 tracking-tighter text-right">₹{Number(invoice.total).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="pt-8 text-left">
                            <div className="rounded-2xl p-6 border-2 border-slate-300 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Institutional Paid</span>
                                        <span className="text-xl font-bold text-emerald-600 tracking-tighter text-right">₹{Number(invoice.total_paid).toFixed(2)}</span>
                                    </div>
                                    <div className="h-px bg-slate-200 my-4"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">Outstanding</span>
                                        <span className="text-lg font-bold text-slate-800 tracking-tighter text-right">₹{Number(invoice.outstanding_amount).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PremiumPrintFooter
                signatureLabel="Authorized Auditor"
                note="This document is a formal tax invoice. Payment is due immediately unless otherwise agreed. For clinical queries, please contact our medical desk."
            />
        </PremiumPrintWrapper>
    )
}
