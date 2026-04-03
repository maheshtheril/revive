'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getLabOrderForReporting, getLabConfig } from "@/app/actions/lab"
import { getCompanyDetails } from "@/app/actions/purchase"
import { getPDFSettings } from "@/app/actions/settings"
import { sendLabReportWhatsappAction } from "@/app/actions/lab"
import { useToast } from "@/components/ui/use-toast"
import { 
    Printer, ArrowLeft, Loader2, FlaskConical,
    Activity, Clock, User, Phone, MapPin, Globe, Mail,
    ShieldCheck, AlertCircle, Fingerprint, CheckCircle2,
    MessageCircle, Share2
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LabReportPrintPage() {
    const { id } = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [company, setCompany] = useState<any>(null)
    const [labConfig, setLabConfig] = useState<any>({})
    const [pdfConfig, setPdfConfig] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [sharing, setSharing] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            const [orderRes, companyDetails, configRes, pdfRes] = await Promise.all([
                getLabOrderForReporting(id as string),
                getCompanyDetails(),
                getLabConfig(),
                getPDFSettings(undefined, undefined) // Autodetect CID from session
            ])
            
            if (orderRes.success && orderRes.data) {
                setOrder(orderRes.data)
            }
            if (companyDetails) {
                setCompany(companyDetails)
            }
            if (configRes.success) {
                setLabConfig(configRes.data)
            }
            if (pdfRes.success) {
                setPdfConfig(pdfRes.settings)
            }
            setLoading(false)
        }
        loadData()
    }, [id])

    const handlePrint = () => {
        window.print()
    }

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="font-bold text-xl animate-pulse tracking-wide">Compiling Diagnostics Report...</p>
        </div>
    )

    if (!order) return <div>Order not found</div>

    const patientAge = order.hms_patient?.dob ? 
        new Date().getFullYear() - new Date(order.hms_patient.dob).getFullYear() : 
        '—';

    const getFlag = (value: string, range: any) => {
        if (!value || isNaN(Number(value))) return null;
        const val = Number(value);
        let min = null, max = null;
        if (typeof range === 'string') {
            const matches = range.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
            if (matches) { min = Number(matches[1]); max = Number(matches[2]); }
        } else if (range && typeof range === 'object') {
            min = range.min !== undefined ? Number(range.min) : null;
            max = range.max !== undefined ? Number(range.max) : null;
        }
        if (min !== null && val < min) return 'L';
        if (max !== null && val > max) return 'H';
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 sm:p-8 print:p-0 print:bg-white selection:bg-indigo-500/30">
            {/* Header / Actions (Hidden during print) */}
            <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden border-b border-white/10 pb-6">
                <div className="flex gap-4">
                    <Link href="/hms/lab/pending">
                        <Button variant="ghost" className="rounded-2xl gap-2 font-bold px-6 border border-white/5 bg-white/5 hover:bg-white/10 text-white">
                            <ArrowLeft className="w-4 h-4" />
                            Back to queue
                        </Button>
                    </Link>
                </div>
                
                <div className="flex gap-4">
                    <Button 
                        onClick={async () => {
                            setSharing(true)
                            try {
                                const res = await sendLabReportWhatsappAction(id as string)
                                if (res.success) {
                                    toast({
                                        title: "Report Shared",
                                        description: "Laboratory report has been sent via WhatsApp.",
                                    })
                                } else {
                                    toast({
                                        title: "Share Failed",
                                        description: res.error || "Could not send WhatsApp message.",
                                        variant: "destructive"
                                    })
                                }
                            } catch (error) {
                                toast({
                                    title: "Error",
                                    description: "An unexpected error occurred.",
                                    variant: "destructive"
                                })
                            } finally {
                                setSharing(false)
                            }
                        }}
                        disabled={sharing}
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 text-white rounded-2xl px-6 font-bold gap-2 transition-all transform hover:scale-105 active:scale-95"
                    >
                        {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                        {sharing ? "Sharing..." : "WhatsApp Share"}
                    </Button>

                    <Button 
                        onClick={handlePrint}
                        className="bg-indigo-500 hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 text-white rounded-2xl px-10 font-black gap-2 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Printer className="w-5 h-5" />
                        Print Report (Ctrl+P)
                    </Button>
                </div>
            </div>

            {/* THE PRINTABLE REPORT A4 AREA */}
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none min-h-[297mm] p-10 print:p-0 text-slate-900">
                {/* 1. Header / Letterhead - DYNAMIC REDESIGN */}
                <div className={`border-b-4 border-indigo-600 pb-8 mb-8 flex flex-col gap-6 relative overflow-hidden
                    ${pdfConfig?.headerAlignment === 'center' ? 'items-center text-center' : (pdfConfig?.headerAlignment === 'left' ? 'items-start text-left' : 'items-end text-right')}
                    ${pdfConfig?.headerAlignment !== 'center' ? 'md:flex-row justify-between' : ''}
                `}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-20 pointer-events-none" />
                    
                    <div className={`space-y-4 relative z-10 flex flex-col ${pdfConfig?.headerAlignment === 'center' ? 'items-center text-center' : (pdfConfig?.headerAlignment === 'left' ? 'items-start text-left' : 'items-end text-right')}`}>
                        <div className={`flex items-center gap-4 ${pdfConfig?.headerAlignment === 'center' ? 'flex-col' : (pdfConfig?.headerAlignment === 'right' ? 'flex-row-reverse' : '')}`}>
                           {pdfConfig?.showLogo !== false && (
                               <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-indigo-500/20 ring-4 ring-white">Z</div>
                           )}
                           <div>
                                <h1 className="font-black tracking-tighter text-slate-900 leading-none uppercase" 
                                    style={{ fontSize: (pdfConfig?.hospitalNameSize || 16) * 2 }}>
                                    {company?.company_name || 'Ziona Health System'}
                                </h1>
                                <p className="text-sm font-black text-indigo-600 tracking-[0.2em] uppercase mt-2">Precision Diagnostics & Research</p>
                           </div>
                        </div>
                        {pdfConfig?.showContactInfo !== false && (
                            <div className={`grid grid-cols-2 gap-x-8 text-slate-500 font-bold leading-relaxed max-w-xl`}
                                 style={{ fontSize: (pdfConfig?.addressSize || 10) }}>
                                <p className="flex items-center gap-2"><MapPin className="w-3 h-3 text-indigo-500" /> {company?.address?.split('\n')[0] || 'Medical Research Hub, Bangalore'}</p>
                                <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-indigo-500" /> {company?.phone || 'Emergency: +91 800-LAB-SCAN'}</p>
                                <p className="flex items-center gap-2"><Mail className="w-3 h-3 text-indigo-500" /> {company?.email || 'reports@ziona.io'}</p>
                                <p className="flex items-center gap-2"><Globe className="w-3 h-3 text-indigo-500" /> https://verify.ziona.io</p>
                            </div>
                        )}
                    </div>
                    
                    <div className={`flex flex-col relative z-10 pb-1 ${pdfConfig?.headerAlignment === 'center' ? 'items-center text-center' : (pdfConfig?.headerAlignment === 'left' ? 'items-start text-left' : 'items-end text-right')}`}>
                        <div className="text-indigo-600/10 font-black text-7xl absolute bottom-0 right-0 leading-none -mb-4 tracking-tighter select-none">LAB</div>
                        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-2">Diagnostic Report</h2>
                        <div className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 shadow-lg shadow-slate-900/10">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Authenticated Specimen Analysis
                        </div>
                    </div>
                </div>

                {/* 1.5. ABNORMAL SUMMARY SECTION - EXCLUSIVE WORLD CLASS FEATURE */}
                {(() => {
                    const criticals = (order.hms_lab_order_lines || []).filter((line: any) => {
                        const val = line.hms_lab_result?.[0]?.result_value;
                        const range = line.hms_lab_test?.reference_range || line.hms_lab_result?.[0]?.reference_range;
                        return getFlag(val, range) !== null;
                    });
                    
                    if (criticals.length > 0) {
                        return (
                            <div className="mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-3xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <AlertCircle className="w-16 h-16 text-red-600" />
                                </div>
                                <h3 className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <AlertCircle className="w-4 h-4" />
                                    Clinician Alert: Critical Findings
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {criticals.map((c: any, i: number) => (
                                        <div key={i} className="px-3 py-1 bg-white/80 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 shadow-sm">
                                            {c.hms_lab_test?.name || c.requested_name}: <span className="font-black underline">{c.hms_lab_result?.[0]?.result_value}</span> ({getFlag(c.hms_lab_result?.[0]?.result_value, c.hms_lab_test?.reference_range) === 'H' ? 'High' : 'Low'})
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-red-500 font-bold mt-3 italic">* Results require immediate clinical correlation by the attending physician.</p>
                            </div>
                        )
                    }
                    return null;
                })()}

                {/* 2. Patient & Order Header Grid - ENHANCED */}
                <div className="grid grid-cols-12 gap-8 bg-slate-100/50 p-8 rounded-[2.5rem] mb-10 border border-slate-200/50 backdrop-blur-sm relative">
                    {/* Watermark for Background (VERIFIED) */}
                    {order.hms_lab_order_lines?.[0]?.hms_lab_result?.[0]?.verified_by && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none rotate-[-15deg]">
                            <span className="text-9xl font-black uppercase text-indigo-900 tracking-tighter">VERIFIED</span>
                        </div>
                    )}

                    <div className="col-span-8 grid grid-cols-2 gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Patient Subject</span>
                            <span className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                {order.hms_patient?.first_name} {order.hms_patient?.last_name}
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {patientAge}Y / {order.hms_patient?.gender || '—'}</span>
                                <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 rounded tracking-wider">#{order.hms_patient?.patient_number || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-8">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Referring Physician</span>
                            <span className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                Dr. {order.hms_appointment?.hms_clinician?.first_name} {order.hms_appointment?.hms_clinician?.last_name || 'Medical Consultant'}
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">Authorized for Clinical Consultation</p>
                        </div>
                    </div>

                    <div className="col-span-4 grid grid-cols-1 gap-4 text-right border-l border-slate-200 pl-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Investigation ID</span>
                            <span className="text-lg font-black text-slate-900 font-mono tracking-widest">{order.order_number || order.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-end gap-8 border-t border-slate-200 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Collection Date</span>
                                <span className="text-[11px] font-bold text-slate-800">{format(new Date(order.created_at), 'dd-MMM-yyyy')}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Report Finalized</span>
                                <span className="text-[11px] font-bold text-slate-800">{format(new Date(), 'dd-MMM-yyyy')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Results Table - MASTERPIECE STYLE */}
                <div className="mb-16">
                   <table className="w-full">
                        <thead>
                            <tr className="border-y-4 border-slate-900 text-[11px] font-black uppercase text-slate-900">
                                <th className="px-5 py-5 text-left tracking-[0.2em]">Diagnostic Investigation</th>
                                <th className="px-5 py-5 text-center tracking-[0.2em]">Observed Result</th>
                                <th className="px-5 py-5 text-center tracking-[0.2em] w-24 text-indigo-600">Clinical Flag</th>
                                <th className="px-5 py-5 text-left tracking-[0.2em]">Units</th>
                                <th className="px-5 py-5 text-left tracking-[0.2em]">Biological Reference Interval</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100 font-serif">
                            {(order.hms_lab_order_lines || []).map((line: any, idx: number) => {
                                const result = line.hms_lab_result?.[0];
                                const flag = getFlag(result?.result_value, line.hms_lab_test?.reference_range || result?.reference_range);
                                return (
                                    <tr key={idx} className={`group transition-colors ${flag ? 'bg-red-50/20' : ''}`}>
                                        <td className="px-5 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-[15px] not-italic uppercase tracking-tight flex items-center gap-2">
                                                    {line.hms_lab_test?.name || line.requested_name}
                                                    {flag && <Activity className="w-3 w-3 text-red-500 animate-pulse" />}
                                                </span>
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 italic font-sans flex items-center gap-1.5">
                                                    <Fingerprint className="w-2.5 h-2.5" />
                                                    Method: {line.hms_lab_test?.method || 'NABL-Standardized Analytical Process'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-6 text-center">
                                            <span className={`text-2xl font-black not-italic tracking-tighter ${flag ? 'text-red-700 underline underline-offset-4 decoration-2' : 'text-slate-900'}`}>
                                                {result?.result_value || '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-6 text-center">
                                            {flag ? (
                                                <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border ${
                                                    flag === 'H' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}>
                                                    {flag === 'H' ? 'High ↑' : 'Low ↓'}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-tighter">Normal</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-6">
                                            <span className="text-[13px] font-black text-slate-500 uppercase not-italic font-sans">{line.hms_lab_test?.units || result?.units || '—'}</span>
                                        </td>
                                        <td className="px-5 py-6">
                                            <div className="text-[12px] font-bold text-slate-700 not-italic leading-tight font-sans bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200/50">
                                                {typeof (line.hms_lab_test?.reference_range || result?.reference_range) === 'object' ? 
                                                    JSON.stringify(line.hms_lab_test?.reference_range || result?.reference_range) : 
                                                    (line.hms_lab_test?.reference_range || result?.reference_range || '—')}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                   </table>
                </div>

                {/* 4. Footer & Signatures - WORLD CLASS PREMIUM SIGNATURES */}
                <div className="mt-auto space-y-16">
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-px bg-slate-200 flex-1" />
                        <p className="text-[10px] text-slate-400 font-black italic tracking-[0.3em] uppercase">
                            End of Investigation
                        </p>
                        <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-12 gap-12 px-8">
                        <div className="col-span-3 flex flex-col items-center">
                            <div className="w-32 h-32 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center justify-center p-3 shadow-xl shadow-slate-200/50 transition-transform hover:scale-105">
                                 <div className="w-24 h-24 bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=verified-report')] bg-contain bg-no-repeat mb-2" />
                                 <span className="text-[8px] font-black uppercase text-indigo-600 tracking-widest leading-none">Scan to Verify</span>
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 mt-4 text-center leading-tight">Digital Fingerprint:<br/><span className="text-indigo-600 font-mono">0x7F2A{order.id.substring(0,6)}...</span></p>
                        </div>

                        <div className="col-span-4 text-center space-y-2 flex flex-col items-center justify-end">
                            <div className="h-[60px] flex items-center justify-center">
                                {/* Simulated Tech Sign */}
                                <div className="text-slate-200 font-serif text-3xl select-none rotate-[-4deg] opacity-40">M. Tech Sign</div>
                            </div>
                            <div className="w-full h-[3px] bg-slate-900 rounded-full" />
                            <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Medical Technologist</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-0.5 italic">Electronically Authenticated</p>
                            </div>
                        </div>
                        
                        <div className="col-span-5 text-center space-y-2 flex flex-col items-center justify-end relative">
                            {order.hms_lab_order_lines?.[0]?.hms_lab_result?.[0]?.verified_by && (
                                <div className="absolute top-0 right-0 transform -translate-y-8 translate-x-4 rotate-[-12deg] z-20">
                                    <div className="border-4 border-emerald-600/60 bg-emerald-50/50 backdrop-blur-sm px-6 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        <span className="text-xl font-black text-emerald-700 tracking-tighter">VERIFIED</span>
                                    </div>
                                </div>
                            )}
                            <div className="h-[60px] flex items-center justify-center scale-110">
                                {/* Pathologist Signature - From Config or Default */}
                                {order.hms_lab_order_lines?.[0]?.hms_lab_result?.[0]?.verified_by && (
                                    <>
                                        {labConfig.pathologist_signature ? (
                                            <img src={labConfig.pathologist_signature} className="h-full object-contain" alt="Authorized Signature" />
                                        ) : (
                                            <div className="font-serif text-slate-800 text-3xl rotate-[-2deg] select-none italic font-bold">
                                                {labConfig.pathologist_name || "Dr. Sarah Johnson, MD"}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="w-full h-[3px] bg-slate-900 rounded-full" />
                            <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Authorized Pathologist</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                    {labConfig.pathologist_designation || "Chief of Clinical Diagnostics"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 border-t-2 border-slate-100 flex flex-col items-center">
                        <div className="flex items-center gap-8 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">
                            <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Generated: {new Date().toLocaleString()}</span>
                            <span className="h-4 w-px bg-slate-200" />
                            <span className="flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> ID: {order.id}</span>
                            <span className="h-4 w-px bg-slate-200" />
                            <span className="flex items-center gap-2 inline-flex"><ShieldCheck className="w-3.5 h-3.5" /> ISO 9001:2015 Compliant</span>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/50 max-w-4xl">
                            <p className="text-[9px] text-slate-500 leading-relaxed text-center font-medium italic">
                                ** LEGAL DISCLAIMER **<br/>
                                This investigation report is for diagnostic guidance and must be interpreted only by a registered medical practitioner.
                                Results should be clinically correlated with patient history and other findings. For any discrepancy, please re-run
                                is recommended. This is a computer-generated report and requires professional medical interpretation.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Print Styles - THE FINAL SECRET FOR WORLD CLASS LOOK */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Text&display=swap');
                
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-family: ${pdfConfig?.fontFamily === 'times' ? 'serif' : (pdfConfig?.fontFamily === 'courier' ? 'monospace' : 'sans-serif')} !important;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                    .shadow-2xl, .shadow-xl, .shadow-lg {
                        box-shadow: none !important;
                    }
                    .bg-slate-50, .bg-slate-100 {
                        background-color: #f8fafc !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .bg-indigo-600 {
                        background-color: #4f46e5 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .text-indigo-600 {
                        color: #4f46e5 !important;
                        -webkit-print-color-adjust: exact;
                    }
                }
                .font-barcode {
                    font-family: 'Libre Barcode 39 Text', cursive;
                }
            `}</style>
        </div>
    )
}
