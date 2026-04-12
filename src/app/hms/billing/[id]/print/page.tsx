import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { PremiumPrintWrapper } from "@/components/print/premium-print-wrapper"
import { PremiumPrintHeader } from "@/components/print/premium-print-header"
import { PremiumPrintFooter } from "@/components/print/premium-print-footer"
import { getCurrentCompany } from "@/app/actions/company"
import { Printer } from "lucide-react"
import { InvoiceControlPanel } from "@/components/billing/invoice-control-panel"

import { getHMSSettings, getPDFSettings, getPDFConfig } from "@/app/actions/settings"

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
    
    // RESOLVE PDF CONFIGURATION: 
    // If it's a prescription, we use the Clinical OP Slip coordinates
    // If it's a bill, we use the active template from the PDF registry
    const pdfConfig = isPrescription 
        ? { coordinates: hmsSettings?.opSlipCoordinates || null }
        : await getPDFConfig(companyData.id, session.user.tenantId!, 'sale_bill');

    const pdfSettingsRes = await getPDFSettings();
    const pdfSettings = pdfSettingsRes.success ? pdfSettingsRes.settings : null;


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
        ? (hmsSettings?.opSlipHeaderHeight || '1.0')
        : (hmsSettings?.billHeaderHeight || '1.0');

    // --- Prescription Print View ---
    if (type === 'prescription') {
        const prescription = await prisma.prescription.findFirst({
            where: { id },
            include: {
                hms_patient: true,
                hms_doctor: true,
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
                    documentNumber={prescription.id.substring(prescription.id.length - 8).toUpperCase()}
                    hide={printMode === 'letterhead'}
                    alignment={pdfSettings?.headerAlignment}
                    addressSize={pdfSettings?.addressSize}
                    showContactInfo={pdfSettings?.showContactInfo}
                    coordinates={pdfConfig?.coordinates}
                    prescription={prescription}
                    patient={{
                        name: `${prescription.hms_patient?.first_name} ${prescription.hms_patient?.last_name}`,
                        id: prescription.hms_patient?.patient_number || 'N/A',
                        ageGender: `${prescription.hms_patient?.gender || ''} | ${(prescription.hms_patient as any)?.age || 'N/A'}`
                    }}
                />

                <div className="flex-1" style={{ marginTop: (pdfConfig?.coordinates as any)?.rxSymbol?.y ? `${(pdfConfig?.coordinates as any).rxSymbol.y - 120}px` : '0px' }}>
                    {/* Patient Info Card - Hidden if using atomic coordinates */}
                    {!(pdfConfig?.coordinates as any)?.patientName && (
                        <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50 p-8 rounded-2xl border border-slate-100 relative overflow-hidden">
                            <div className="relative z-10 font-sans">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 text-left">Patient Details</p>
                                <p className="text-2xl font-bold text-slate-800 mb-1">{prescription.hms_patient?.first_name} {prescription.hms_patient?.last_name}</p>
                                <div className="flex gap-4 text-sm font-bold text-slate-600">
                                    <span>{prescription.hms_patient?.gender}</span>
                                    <span className="text-slate-300">|</span>
                                    <span>{(prescription.hms_patient as any)?.age ? `${(prescription.hms_patient as any).age} Years` : 'N/A'}</span>
                                </div>
                                <p className="text-xs font-mono text-slate-400 mt-2">UHID: {prescription.hms_patient?.patient_number || 'N/A'}</p>
                            </div>
                            <div className="text-right flex flex-col justify-end relative z-10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1 text-right">Date of Visit</p>
                                <p className="text-xl font-bold text-slate-800">{new Date(prescription.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                    )}

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

    const accentColor = pdfSettings?.primaryColor || '#4f46e5';

    // Simple Number to Words (Indian Format Lacs/Crores)
    function numberToWords(num: number): string {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const n = ('000000000' + num.toFixed(0)).substr(-9);
        if (num === 0) return 'Zero';

        let str = '';
        const crore = parseInt(n.substr(0, 2));
        const lakh = parseInt(n.substr(2, 2));
        const thousand = parseInt(n.substr(4, 2));
        const hundred = parseInt(n.substr(6, 1));
        const remaining = parseInt(n.substr(7, 2));

        if (crore > 0) str += (crore < 20 ? a[crore] : b[parseInt(crore.toString().substr(0, 1))] + ' ' + a[parseInt(crore.toString().substr(1, 1))]) + 'Crore ';
        if (lakh > 0) str += (lakh < 20 ? a[lakh] : b[parseInt(lakh.toString().substr(0, 1))] + ' ' + a[parseInt(lakh.toString().substr(1, 1))]) + 'Lakh ';
        if (thousand > 0) str += (thousand < 20 ? a[thousand] : b[parseInt(thousand.toString().substr(0, 1))] + ' ' + a[parseInt(thousand.toString().substr(1, 1))]) + 'Thousand ';
        if (hundred > 0) str += a[hundred] + 'Hundred ';
        if (remaining > 0) str += (str != '' ? 'and ' : '') + (remaining < 20 ? a[remaining] : b[parseInt(remaining.toString().substr(0, 1))] + ' ' + a[parseInt(remaining.toString().substr(1, 1))]);

        return str + 'Only';
    }

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
                title={pdfSettings?.showTaxInvoiceTitle !== false ? "TAX INVOICE" : "INVOICE"}
                subtitle="Formal Financial Settlement"
                documentNumber={invoice.invoice_number}
                hide={printMode === 'letterhead'}
                alignment={pdfSettings?.headerAlignment}
                showLogo={pdfSettings?.showLogo}
                hospitalNameSize={pdfSettings?.hospitalNameSize}
                addressSize={pdfSettings?.addressSize}
                logoPosition={pdfSettings?.logoPosition}
                coordinates={pdfConfig?.coordinates}
                invoice={invoice}
                patient={{
                    name: `${invoice.hms_patient?.first_name} ${invoice.hms_patient?.last_name}`,
                    id: invoice.hms_patient?.patient_number || 'N/A',
                    ageGender: `${invoice.hms_patient?.gender || ''} | ${(invoice.hms_patient as any)?.age || 'N/A'}`
                }}
            />

            <div className="flex-1 font-sans relative" style={{ marginTop: (pdfConfig?.coordinates as any)?.table?.y ? `${(pdfConfig?.coordinates as any).table.y}px` : '0' }}>
                {/* Elite Info Ribbon - Hidden if using atomic coordinates for patient info */}
                {!(pdfConfig?.coordinates as any)?.patientName && (
                    <div className="grid grid-cols-4 gap-4 mb-10">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Date of Issue</p>
                        <p className="text-sm font-black text-slate-800">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Bill Status</p>
                        <p className={`text-sm font-black uppercase ${invoice.status === 'paid' ? 'text-emerald-600' : 'text-orange-500'}`}>{invoice.status}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Payment Mode</p>
                        <p className="text-sm font-black text-slate-800 uppercase">{(invoice as any).payment_mode || 'Cash/POS'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Currency</p>
                        <p className="text-sm font-black text-slate-800 uppercase italic">INR (₹)</p>
                    </div>
                    </div>
                )}

                {/* Recipient & Patient Details - Hidden if using atomic coordinates */}
                {!(pdfConfig?.coordinates as any)?.patientName && (
                    <div className="grid grid-cols-2 gap-12 mb-12 px-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-1 bg-indigo-500 rounded-full" style={{ backgroundColor: accentColor }} />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Patient (Bill To)</h3>
                        </div>
                        <div className="pl-4 border-l border-slate-200 space-y-1">
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{invoice.hms_patient?.first_name} {invoice.hms_patient?.last_name}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient ID: <span className="text-slate-800">{invoice.hms_patient?.patient_number || 'N/A'}</span></p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">MR No: <span className="text-slate-800 italic">{invoice.id.substring(invoice.id.length - 8).toUpperCase()}</span></p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact: <span className="text-slate-800">{(invoice.hms_patient?.contact as any)?.phone || 'N/A'}</span></p>
                        </div>
                    </div>

                    <div className="space-y-4 text-right flex flex-col items-end">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Financial Details</h3>
                            <div className="h-6 w-1 bg-slate-300 rounded-full" />
                        </div>
                        <div className="pr-4 border-r border-slate-200 flex flex-col items-end gap-2">
                            {(() => {
                                const expiry = (invoice.hms_patient?.metadata as any)?.registration_expiry;
                                if (!expiry) return null;
                                const expiryDate = new Date(expiry);
                                const isExpired = expiryDate < new Date();
                                return (
                                    <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isExpired ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                        Reg Validity: {expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                );
                            })()}
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch: <span className="text-slate-800">{companyData.name}</span></p>
                        </div>
                    </div>
                </div>
                )}

                {/* World Standard Clinical Table */}
                <div className="mb-12 overflow-hidden rounded-[2rem] border border-slate-200">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-6">Description & Service Category</th>
                                <th className="px-4 py-6 text-center">HSN/SAC</th>
                                <th className="px-4 py-6 text-right">Qty</th>
                                <th className="px-4 py-6 text-right">Rate</th>
                                <th className="px-4 py-6 text-right">Disc %</th>
                                <th className="px-8 py-6 text-right">Net Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {invoice.hms_invoice_lines.map((item, idx) => {
                                const line = item as any;
                                return (
                                    <tr key={item.id} className="text-slate-700 hover:bg-slate-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <p className="font-black text-slate-900 text-base leading-none mb-1">{item.description}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{item.uom || 'Service'} Group</p>
                                        </td>
                                        <td className="px-4 py-6 text-center text-xs font-mono text-slate-400">{line.hsn_code || '---'}</td>
                                        <td className="px-4 py-6 text-right text-sm font-black">{Number(item.quantity)}</td>
                                        <td className="px-4 py-6 text-right text-sm font-black text-slate-800 italic">₹{parseFloat(String(item.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-6 text-right text-sm font-bold text-rose-500">{Number(line.discount_percent || 0).toFixed(1)}%</td>
                                        <td className="px-8 py-6 text-right text-base font-black text-slate-900">₹{parseFloat(String(item.net_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totals Assessment Block - Hidden if using atomic subtotal/total */}
                {!(pdfConfig?.coordinates as any)?.subtotal && (
                    <div className="grid grid-cols-2 gap-20 mb-16 px-4">
                    <div className="space-y-8">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Amount in Words</p>
                            <p className="text-sm font-black text-slate-800 leading-relaxed italic border-b border-dashed border-slate-300 pb-2">
                                Rupees {numberToWords(Number(invoice.total || 0))} 
                            </p>
                        </div>
                        {pdfSettings?.bankDetails && !pdfSettings?.coordinates && (
                            <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Bank Details & Terms</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase leading-loose whitespace-pre-wrap">{pdfSettings.bankDetails}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-3 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Printer className="h-16 w-16" />
                            </div>
                            <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase tracking-widest">
                                <span>Sub-Total Gross</span>
                                <span className="text-slate-900">₹{Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black text-indigo-500 uppercase tracking-widest">
                                <span>Combined Taxes</span>
                                <span>₹{Number(invoice.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black text-rose-500 uppercase tracking-widest">
                                <span>Total Savings</span>
                                <span>- ₹{Number(invoice.total_discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="h-px bg-slate-200 mt-4 mb-4" />
                            <div className="flex justify-between items-end">
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Invoice Total</p>
                                    <p className="text-4xl font-black text-slate-900 tracking-tighter italic" style={{ color: accentColor }}>₹{Number(invoice.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 px-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Net Paid (Cash/Card)</span>
                                <span className="font-black text-emerald-600 italic">₹{Number(invoice.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-black text-slate-600 uppercase tracking-widest text-[10px]">Total Balance Due</span>
                                <span className="font-black text-slate-900 italic">₹{Number(invoice.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            <PremiumPrintFooter
                signatureLabel="Authorized Finance Auditor"
                note="This is a computer-generated tax invoice and does not require a physical signature for digital audit. For refund queries, please visit the cash counter within 24 hours."
            />
        </PremiumPrintWrapper>
    )
}
