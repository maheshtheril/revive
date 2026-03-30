'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getLabOrderForReporting } from "@/app/actions/lab"
import { getCompanyDetails } from "@/app/actions/purchase" // Using existing action for company info
import { 
    Printer, ArrowLeft, Loader2, FlaskConical,
    Activity, Clock, User, Phone, MapPin, Globe, Mail
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LabReportPrintPage() {
    const { id } = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [company, setCompany] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            const [orderRes, companyDetails] = await Promise.all([
                getLabOrderForReporting(id as string),
                getCompanyDetails()
            ])
            
            if (orderRes.success && orderRes.data) {
                setOrder(orderRes.data)
            }
            if (companyDetails) {
                setCompany(companyDetails)
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
                {/* 1. Header / Letterhead */}
                <div className="border-b-4 border-double border-slate-200 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">Z</div>
                           <div>
                                <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">{company?.company_name || 'Ziona Health System'}</h1>
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Advanced Diagnostics & Research Labs</p>
                           </div>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold space-y-0.5 leading-tight">
                            <p className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-slate-400" /> {company?.address?.split('\n').join(', ') || 'Global Headquarters'}</p>
                            <p className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 text-slate-400" /> {company?.phone || '+91 222-333-444'} | <Mail className="w-2.5 h-2.5 text-slate-400" /> {company?.email || 'lab@ziona.io'}</p>
                            <p className="flex items-center gap-1"><Globe className="w-2.5 h-2.5 text-slate-400" /> https://ziona.io</p>
                        </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                        <h2 className="text-4xl font-black text-slate-200 uppercase tracking-tighter opacity-70">Lab Report</h2>
                        <div className="mt-2 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase">
                            Authenticated Document
                        </div>
                    </div>
                </div>

                {/* 2. Patient & Order Header Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100">
                    <div className="space-y-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Name</span>
                            <span className="text-lg font-black text-slate-900 uppercase">
                                {order.hms_patient?.first_name} {order.hms_patient?.last_name}
                            </span>
                        </div>
                        <div className="flex gap-10">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age / Gender</span>
                                <span className="text-sm font-bold text-slate-800">{patientAge} yrs / {order.hms_patient?.gender || '—'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient UID</span>
                                <span className="text-sm font-bold text-slate-800">{order.hms_patient?.patient_number || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 text-right border-l border-slate-200 pl-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ref By / Clinician</span>
                            <span className="text-md font-bold text-slate-900">
                                Dr. {order.hms_appointment?.hms_clinician?.first_name} {order.hms_appointment?.hms_clinician?.last_name || 'Medical Consultant'}
                            </span>
                        </div>
                        <div className="flex justify-end gap-10">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Report Date</span>
                                <span className="text-sm font-bold text-slate-800">{format(new Date(), 'dd-MMM-yyyy')}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order ID</span>
                                <span className="text-sm font-bold text-slate-800">{order.order_number || order.id.substring(0, 8)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Results Table */}
                <div className="mb-12">
                   <table className="w-full">
                        <thead>
                            <tr className="border-y-2 border-slate-900 text-[10px] font-black uppercase text-slate-900">
                                <th className="px-4 py-3 text-left tracking-widest">Test Investigation</th>
                                <th className="px-4 py-3 text-center tracking-widest">Observed Value</th>
                                <th className="px-4 py-3 text-left tracking-widest">Units</th>
                                <th className="px-4 py-3 text-left tracking-widest">Reference Interval / Interpretation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 italic">
                            {(order.hms_lab_order_lines || []).map((line: any, idx: number) => {
                                const result = line.hms_lab_result?.[0];
                                return (
                                    <tr key={idx} className="group">
                                        <td className="px-4 py-4">
                                            <span className="font-bold text-slate-900 text-sm not-italic uppercase tracking-tight">{line.hms_lab_test?.name || line.requested_name}</span>
                                            {result?.interpreted_value && (
                                                <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                                                    Observation: {result.interpreted_value}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xl font-black text-indigo-900 not-italic tracking-tighter">
                                                {result?.result_value || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs font-black text-slate-500 uppercase not-italic">{line.hms_lab_test?.units || result?.units || '—'}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-[10px] font-bold text-slate-600 not-italic leading-tight">
                                                {typeof line.hms_lab_test?.reference_range === 'object' ? 
                                                    JSON.stringify(line.hms_lab_test?.reference_range) : 
                                                    line.hms_lab_test?.reference_range || result?.reference_range || '—'}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                   </table>
                </div>

                {/* 4. Footer & Signatures */}
                <div className="mt-auto space-y-12">
                    <p className="text-[9px] text-slate-400 text-center font-bold italic">
                        *** End of Laboratory Investigation Report ***
                    </p>

                    <div className="flex justify-between items-end gap-20 px-8">
                        <div className="flex-1 text-center space-y-1">
                            <div className="h-[2px] bg-slate-200 mb-2" />
                            <p className="text-[10px] font-black text-slate-900 uppercase">Technician</p>
                            <p className="text-[8px] font-bold text-slate-400">Computer Generated Signature</p>
                        </div>
                        
                        <div className="flex-1 text-center space-y-1">
                            <div className="h-[2px] bg-slate-200 mb-2" />
                            <p className="text-[10px] font-black text-slate-900 uppercase">Verified By</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{order.hms_lab_order_lines?.[0]?.hms_lab_result?.[0]?.verified_by ? 'Authorized Pathologist' : 'Pending Verification'}</p>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between opacity-50">
                            <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Timestamp: {new Date().toISOString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3" />
                                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Report ID: {order.id}</span>
                            </div>
                        </div>
                        <p className="text-[8px] text-slate-400 leading-relaxed text-justify px-4">
                            Note: These results are to be interpreted by a registered medical practitioner only. Laboratory investigations
                            provide diagnostic guidance and should be correlated with clinical findings and other investigations.
                            In case of results not correlating with clinical features, please verify with the laboratory.
                        </p>
                    </div>
                </div>
            </div>

            {/* Custom Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        background: white;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    )
}
