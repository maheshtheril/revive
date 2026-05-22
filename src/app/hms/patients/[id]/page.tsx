import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, User, Phone, MapPin, Clock, FileText, Plus, Edit, Mail, Package, Activity, Receipt, CreditCard, History, Bed as BedIcon } from "lucide-react"
import { EditPatientButton } from "@/components/hms/patients/edit-patient-button"
import { PatientPaymentDialog } from "@/components/hms/billing/patient-payment-dialog"
import { PatientConsumptionDialog } from "@/components/hms/billing/patient-consumption-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoicePreviewDialog } from "@/components/hms/billing/invoice-preview-dialog"
import { AppointmentManageDialog } from "@/components/hms/appointments/appointment-manage-dialog"
import { ClinicalTimeline } from "@/components/patients/clinical-timeline"
import { PatientHistoryLog } from "@/components/patients/patient-history-log"
import { PatientLedger } from "@/components/patients/patient-ledger"

import { AdmissionDialog } from "@/components/hms/patients/admission-dialog"

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [patient, activeAdmission] = await Promise.all([
        prisma.hms_patient.findUnique({
            where: { id },
            include: {
                hms_appointments: {
                    orderBy: { starts_at: 'desc' },
                    take: 50
                },
                hms_invoice: {
                    orderBy: { created_at: 'desc' },
                    take: 50,
                    include: {
                        hms_invoice_lines: true,
                        hms_patient: true
                    }
                },
                prescription: {
                    orderBy: { created_at: 'desc' },
                    take: 20,
                    include: {
                        prescription_items: {
                            include: {
                                hms_product: true
                            }
                        }
                    }
                },
                hms_vitals: {
                    orderBy: { recorded_at: 'desc' },
                    take: 50
                }
            }
        }),
        prisma.hms_admission.findFirst({
            where: {
                patient_id: id,
                status: 'admitted'
            }
        })
    ])

    // Fetch doctors for appointment dialog
    const doctors = await prisma.hms_clinicians.findMany({
        where: { is_active: true },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            hms_specializations: { select: { name: true } },
            role: true,
            consultation_start_time: true,
            consultation_end_time: true
        },
        orderBy: { first_name: 'asc' }
    })

    if (!patient) {
        return notFound()
    }

    // Fetch Nursing Consumption History (Linked to Encounters/Appointments)
    const appointmentIds = patient.hms_appointments.map(a => a.id)
    const consumptionHistory = await prisma.hms_stock_move.findMany({
        where: {
            source_reference: { in: appointmentIds },
            source: 'Nursing Consumption'
        },
        orderBy: { created_at: 'desc' },
        take: 50
    })

    // Fetch product details manually
    const pIds = [...new Set(consumptionHistory.map(c => c.product_id))]
    const prods = await prisma.hms_product.findMany({ where: { id: { in: pIds } }, select: { id: true, name: true } })
    const productMap = new Map(prods.map(p => [p.id, p.name]))

    // Fetch User Details for Consumption (Nurses)
    const userIds = [...new Set(consumptionHistory.map(c => c.created_by).filter(Boolean))] as string[]
    const users = await prisma.app_user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, full_name: true } })
    const userMap = new Map(users.map(u => [u.id, u.full_name || u.name || 'Unknown']))

    // Group Consumption into Events (same logic as history action)
    const consumptionEvents: any[] = []
    consumptionHistory.forEach(move => {
        const moveTime = new Date(move.created_at).getTime()
        let event = consumptionEvents.find(e => Math.abs(new Date(e.date).getTime() - moveTime) < 2000 && e.nurseId === move.created_by)

        if (!event) {
            event = {
                type: 'consumption_group',
                date: move.created_at,
                nurseName: userMap.get(move.created_by || '') || 'Unknown Nurse',
                nurseId: move.created_by,
                items: []
            }
            consumptionEvents.push(event)
        }

        event.items.push({
            productName: productMap.get(move.product_id) || 'Unknown Item',
            qty: Number(move.qty),
            uom: move.uom
        })
    })

    // Merge Clinical Events for Timeline
    const timelineEvents = [
        ...patient.hms_vitals.map(v => ({
            type: 'vital',
            date: v.recorded_at,
            data: v
        })),
        ...consumptionEvents,
        ...patient.hms_appointments.map(a => ({
            type: 'appointment',
            date: a.starts_at,
            data: a
        })),
        ...patient.hms_invoice.map(i => ({
            type: 'invoice',
            date: i.created_at,
            data: i
        })),
        ...patient.prescription.map(p => ({
            type: 'prescription',
            date: p.created_at,
            data: p
        }))
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())

    // [CRITICAL] Serialize Prisma Decimal objects for Client Components
    const serializedPatient = JSON.parse(JSON.stringify(patient));
    const patientAny = serializedPatient; // Use serialized version for all client-side props

    const serializedTimelineEvents = JSON.parse(JSON.stringify(timelineEvents));

    // Group Timeline Events by Date for World-Class Presentation
    const groupedTimeline: { [key: string]: any[] } = {};
    serializedTimelineEvents.forEach((event: any) => {
        const dateKey = new Date(event.date || 0).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!groupedTimeline[dateKey]) groupedTimeline[dateKey] = [];
        groupedTimeline[dateKey].push(event);
    });

    // Calculate financials
    const totalInvoiced = patient.hms_invoice.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
    const totalOutstanding = patient.hms_invoice.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0)

    return (
        <div className="h-screen w-full bg-slate-100/50 p-2 md:p-4 lg:p-6 flex flex-col overflow-hidden">
            {/* "Popup" Window Container */}
            <div className="flex-1 bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative">

                {/* 1. Header Section */}
                <div className="shrink-0 bg-white border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
                    <div className="flex items-center gap-5">
                        <Link href="/hms/patients" className="h-10 w-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 shadow-sm">
                            <ArrowLeft className="h-5 w-5 text-slate-600" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{patientAny.first_name} {patientAny.last_name}</h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${patientAny.gender === 'male' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    patientAny.gender === 'female' ? 'bg-pink-50 text-pink-700 border border-pink-100' : 'bg-slate-50 text-slate-700 border border-slate-100'
                                    }`}>
                                    {patientAny.gender || 'Unknown'}
                                </span>
                            </div>
                            <p className="text-slate-500 flex items-center gap-4 mt-1 text-sm font-medium">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>ID: <span className="font-mono text-slate-700">{patientAny.patient_number || 'N/A'}</span></span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Born: {patientAny.dob ? new Date(patientAny.dob).toLocaleDateString() : '-'}</span>
                                {(patientAny.contact as any)?.phone && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span><Phone className="h-3 w-3" /> {(patientAny.contact as any).phone}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {!activeAdmission ? (
                            <div className="bg-emerald-50 p-1 pr-4 rounded-xl border border-emerald-100 flex items-center gap-2">
                                <AdmissionDialog
                                    patientId={patientAny.id}
                                    patientName={`${patientAny.first_name} ${patientAny.last_name}`}
                                />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter italic">Outpatient</span>
                            </div>
                        ) : (
                            <div className="h-10 px-4 flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <BedIcon className="h-4 w-4" />
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase tracking-tighter leading-none">Admitted</p>
                                    <p className="text-[11px] font-bold">{activeAdmission.ward} - Unit {activeAdmission.bed}</p>
                                </div>
                            </div>
                        )}
                        <button className="h-10 px-4 flex items-center gap-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all font-medium text-sm shadow-sm" title="Print Medical Record">
                            <FileText className="h-4 w-4" /> Print
                        </button>
                        <PatientPaymentDialog
                            patientId={patientAny.id}
                            patientName={`${patientAny.first_name} ${patientAny.last_name}`}
                        />
                        <PatientConsumptionDialog
                            patientId={patientAny.id}
                            patientName={`${patientAny.first_name} ${patientAny.last_name}`}
                        />
                        <EditPatientButton patient={patientAny} />
                        <AppointmentManageDialog
                            patient={patientAny}
                            doctors={doctors}
                            trigger={
                                <button
                                    className="h-10 px-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    <Plus className="h-4 w-4" />
                                    Book Checkup
                                </button>
                            }
                        />
                    </div>
                </div>

                {/* 2. Tabs Navigation */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                        <TabsList className="h-12 bg-transparent gap-6 p-0">
                            <TabsTrigger value="overview" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-2 text-slate-500 font-medium text-sm hover:text-indigo-500 transition-colors">
                                <FileText className="h-4 w-4 mr-2" />
                                360° Overview
                            </TabsTrigger>
                            <TabsTrigger value="clinical" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-2 text-slate-500 font-medium text-sm hover:text-indigo-500 transition-colors">
                                <Activity className="h-4 w-4 mr-2" />
                                Clinical Data
                            </TabsTrigger>
                            <TabsTrigger value="financials" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-2 text-slate-500 font-medium text-sm hover:text-indigo-500 transition-colors">
                                <CreditCard className="h-4 w-4 mr-2" />
                                Financials
                            </TabsTrigger>
                            <TabsTrigger value="history" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-2 text-slate-500 font-medium text-sm hover:text-indigo-500 transition-colors">
                                <Clock className="h-4 w-4 mr-2" />
                                History Log
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* 3. Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 md:p-8 scroll-smooth">

                        {/* TAB: OVERVIEW (Timeline) */}
                        <TabsContent value="overview" className="m-0 h-full overflow-y-auto no-scrollbar selection:bg-indigo-100">
                            <ClinicalTimeline patientId={id} />
                        </TabsContent>

                        {/* TAB: CLINICAL */}
                        <TabsContent value="clinical" className="m-0 max-w-7xl mx-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Vitals Card */}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-cyan-500" /> Vitals History
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        {patient.hms_vitals.map((v, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="text-xs font-mono font-medium text-slate-500">
                                                    {v.recorded_at ? new Date(v.recorded_at).toLocaleDateString() : '-'} <br />
                                                    {v.recorded_at ? new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                                <div className="text-right flex gap-4">
                                                    <div>
                                                        <span className="block text-[10px] uppercase text-slate-400 font-bold">BP</span>
                                                        <span className="font-mono font-bold text-slate-800">{Number(v.systolic)}/{Number(v.diastolic)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase text-slate-400 font-bold">HR</span>
                                                        <span className="font-mono font-bold text-slate-800">{Number(v.pulse)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase text-slate-400 font-bold">Temp</span>
                                                        <span className="font-mono font-bold text-slate-800">{Number(v.temperature)}°</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {patient.hms_vitals.length === 0 && <p className="text-slate-400 text-sm italic">No vitals recorded.</p>}
                                    </div>
                                </div>

                                {/* Clinical Notes / Consumption */}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <Package className="h-5 w-5 text-orange-500" /> Medications / Consumption
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        {consumptionEvents.map((c: any, i) => (
                                            <div key={i} className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-xs font-bold uppercase text-orange-800 bg-orange-100 px-2 py-0.5 rounded">{new Date(c.date).toLocaleDateString()}</span>
                                                    <span className="text-xs font-medium text-orange-600">Recorded by {c.nurseName}</span>
                                                </div>
                                                {c.items.map((item: any, j: number) => (
                                                    <div key={j} className="flex justify-between text-sm text-slate-700 py-1 border-b border-orange-100/50 last:border-0">
                                                        <span>{item.productName}</span>
                                                        <span className="font-mono font-bold">{item.qty} {item.uom}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        {consumptionEvents.length === 0 && <p className="text-slate-400 text-sm italic">No consumption records.</p>}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: FINANCIALS */}
                        <TabsContent value="financials" className="m-0 max-w-7xl mx-auto space-y-12 pb-20">
                            {/* WORLD CLASS LEDGER VIEW */}
                            <div className="space-y-4">
                              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 px-2">
                                <span className="h-8 w-1.5 rounded-full bg-indigo-600" />
                                Patient Journal Ledger
                              </h3>
                              <PatientLedger patientId={id} />
                            </div>

                            <div className="h-px bg-slate-200 w-full" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <p className="text-slate-500 font-medium text-sm">Summary Invoiced</p>
                                    <p className="text-3xl font-black text-slate-900 mt-2">₹{totalInvoiced.toLocaleString()}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <p className="text-slate-500 font-medium text-sm">Net Outstanding</p>
                                    <p className={`text-3xl font-black mt-2 ${totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{totalOutstanding.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-widest">Historical Invoice Stream</h3>
                                    <p className="text-xs text-slate-500 mt-1">Direct access to individual bill documents</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {patient.hms_invoice.map((inv, i) => {
                                        const serializedInv = JSON.parse(JSON.stringify(inv));
                                        return (
                                            <InvoicePreviewDialog
                                                key={i}
                                                invoice={serializedInv}
                                                trigger={
                                                    <div className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer w-full">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'}`}>
                                                                <Receipt className="h-6 w-6" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                                    {inv.invoice_no || inv.invoice_number ? `Invoice #${inv.invoice_no || inv.invoice_number}` : 'DRAFT INVOICE'}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-medium">{new Date(inv.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-mono font-black text-slate-900 text-lg">₹{Number(inv.total || 0).toLocaleString()}</p>
                                                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                                {inv.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                }
                                            />
                                        )
                                    })}
                                    {patient.hms_invoice.length === 0 && <p className="p-12 text-slate-400 text-center italic font-medium">No archived invoices found for this patient.</p>}
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: HISTORY (Administrative audit logs) */}
                        <TabsContent value="history" className="m-0 max-w-7xl mx-auto animate-in fade-in-50 duration-500 overflow-y-auto no-scrollbar">
                            <PatientHistoryLog patientId={id} />
                        </TabsContent>

                    </div>
                </Tabs>
            </div>
        </div>
    )
}
