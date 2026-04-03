'use client'

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Activity, Stethoscope, Users, Clock, Calendar,
    ChevronRight, Search, Bell, FileText, Pill,
    CheckCircle2, AlertCircle, TrendingUp, User, Smartphone
} from "lucide-react"
import { ScannerModal } from "./scanner-modal"
import { useRouter } from "next/navigation"
import { differenceInYears } from "date-fns"
import { VisitTypeBadge } from "../visit-type-badge"
import Link from "next/link"

interface DoctorDashboardProps {
    doctorName: string
    doctorId: string
    appointments: any[]
    stats: {
        total: number
        waiting: number
        completed: number
    }
}

export function DoctorDashboardClient({ doctorName, doctorId, appointments, stats }: DoctorDashboardProps) {
    const router = useRouter()
    const [selectedTab, setSelectedTab] = useState<'queue' | 'history'>('queue')
    const [searchQuery, setSearchQuery] = useState("")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [selectedPatientForScan, setSelectedPatientForScan] = useState<{ id: string, name: string, appointmentId: string } | null>(null)

    const openScanner = (patientId: string, name: string, appointmentId: string) => {
        setSelectedPatientForScan({ id: patientId, name, appointmentId })
        setIsScannerOpen(true)
    }

    // Filter appointments based on tab and search
    const displayedAppointments = appointments.filter(a => {
        const inQueue = a.status !== 'completed' && a.status !== 'cancelled'
        const inHistory = a.status === 'completed'

        const matchesTab = selectedTab === 'queue' ? inQueue : inHistory

        if (!matchesTab) return false
        if (!searchQuery) return true

        const q = searchQuery.toLowerCase()
        return (
            a.patient_name.toLowerCase().includes(q) ||
            (a.patient_id && a.patient_id.toString().toLowerCase().includes(q))
        )
    })

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER SECTION */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight"
                        >
                            {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">{doctorName}</span>
                        </motion.h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {mounted ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Loading Date...'}
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">v2.0 Live</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Bell className="h-6 w-6 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" />
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-slate-50" />
                        </div>
                        <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            {doctorName.split('Dr. ')[1]?.charAt(0) || 'D'}
                        </div>
                    </div>
                </header>

                {/* STATS GRID */}
                {/* STATS GRID COMPACT */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <Users className="h-24 w-24 text-blue-600" />
                        </div>
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.total}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Appts</p>
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <Clock className="h-24 w-24 text-orange-600" />
                        </div>
                        <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.waiting}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Waiting Now</p>
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <CheckCircle2 className="h-24 w-24 text-emerald-600" />
                        </div>
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.completed}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Completed</p>
                        </div>
                    </motion.div>
                </motion.div>

                {/* MAIN CONTENT AREA - ENHANCED FOCUS */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[800px]">

                    {/* QUEUE HEADER */}
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                    <Stethoscope className="h-5 w-5" />
                                </div>
                                Patient Queue
                            </h2>
                            <p className="text-slate-500 font-medium ml-[3.25rem] mt-1">Manage today's consultations and flow</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-11 pr-4 py-3 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-4 focus:ring-blue-100 outline-none w-full shadow-sm transition-all"
                                />
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex w-full sm:w-auto">
                                <button
                                    onClick={() => setSelectedTab('queue')}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${selectedTab === 'queue' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                >
                                    Waiting
                                </button>
                                <button
                                    onClick={() => setSelectedTab('history')}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${selectedTab === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                >
                                    History
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SCROLLABLE LIST AREA */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 bg-slate-50/30 dark:bg-slate-900/30 scroll-smooth">
                        <AnimatePresence mode="popLayout">
                            {displayedAppointments.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-center p-12 opacity-60"
                                >
                                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                        <Users className="h-10 w-10 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">No patients found</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-2">There are no appointments matching your current filter in the queue.</p>
                                </motion.div>
                            ) : (
                                displayedAppointments.map((apt, index) => {
                                    const isEmergency = apt.type === 'emergency' || apt.tags?.includes('EMERGENCY');
                                    const isUrgent = apt.priority === 'urgent';
                                    const isHigh = apt.priority === 'high';
                                    const isCritical = isEmergency || isUrgent || isHigh || apt.tags?.some((t: string) => ['ACCIDENT', 'SUICIDE_ATTEMPT', 'EMERGENCY', 'MLC'].includes(t));

                                    let cardColor = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800';
                                    let borderL = 'border-l-2 border-l-slate-200';

                                    if (isEmergency) {
                                        cardColor = 'bg-red-50/90 dark:bg-red-950/30 border-red-200 dark:border-red-900';
                                        borderL = 'border-l-4 border-l-red-600';
                                    } else if (isUrgent) {
                                        cardColor = 'bg-orange-50/90 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900';
                                        borderL = 'border-l-4 border-l-orange-500';
                                    } else if (isHigh) {
                                        cardColor = 'bg-amber-50/90 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900';
                                        borderL = 'border-l-4 border-l-amber-400';
                                    } else if (selectedTab === 'history') {
                                        if (apt.invoiceStatus === 'paid') borderL = 'border-l-4 border-l-emerald-500';
                                        else if (apt.invoiceStatus === 'pending') borderL = 'border-l-4 border-l-amber-500';
                                        else borderL = 'border-l-4 border-l-slate-300';
                                    } else if (apt.status === 'in_progress') {
                                        borderL = 'border-l-4 border-l-blue-500';
                                    } else if (apt.vitals_done) {
                                        borderL = 'border-l-4 border-l-emerald-500';
                                    }

                                    return (
                                        <motion.div
                                            key={apt.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`rounded-2xl p-5 border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden ${cardColor} ${borderL}`}
                                        >


                                            <div className="flex flex-col xl:flex-row xl:items-center gap-6">

                                                {/* Time & Avatar */}
                                                <div className="flex items-center gap-5 min-w-[180px]">
                                                    <div className="text-center min-w-[50px]">
                                                        <p className="text-xl font-black text-slate-900 dark:text-white">
                                                            {new Date(apt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0]}
                                                        </p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(apt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1]}</p>
                                                    </div>
                                                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner ${apt.patient_gender === 'Female' ? 'bg-pink-50 text-pink-500' : 'bg-indigo-50 text-indigo-500'
                                                        }`}>
                                                        {apt.patient_name.charAt(0)}
                                                    </div>
                                                    <div className="xl:hidden">
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                            {apt.patient_name}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 font-bold">#{apt.patient_id || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {/* Patient Details */}
                                                <div className="flex-1 space-y-3">
                                                    <div className="hidden xl:flex flex-wrap items-center gap-3">
                                                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                            {apt.patient_name}
                                                        </h3>
                                                        {isEmergency && <span className="px-2.5 py-1 rounded-full text-[9px] bg-red-600 text-white font-black animate-pulse shadow-sm shadow-red-200 uppercase tracking-wider">Critical</span>}
                                                        {isUrgent && <span className="px-2.5 py-1 rounded-full text-[9px] bg-orange-500 text-white font-black uppercase tracking-wider">Urgent</span>}
                                                        {isHigh && <span className="px-2.5 py-1 rounded-full text-[9px] bg-amber-500 text-white font-black uppercase tracking-wider">High</span>}

                                                        {apt.vitals_done ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] bg-emerald-100/80 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1 uppercase tracking-wider">
                                                                <Activity className="h-3 w-3" /> Vitals Ready
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] bg-slate-100 text-slate-500 font-bold border border-slate-200 flex items-center gap-1 uppercase tracking-wider opacity-70">
                                                                <Clock className="h-3 w-3" /> Waiting for Vitals
                                                            </span>
                                                        )}

                                                        <VisitTypeBadge type={apt.type || 'consultation'} />

                                                        {apt.lab_status && apt.lab_status.hasLab && (
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 uppercase tracking-wider ${apt.lab_status.isReady
                                                                ? 'bg-violet-100 text-violet-700 border-violet-200 animate-pulse'
                                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                                                }`}>
                                                                <FileText className="h-3 w-3" />
                                                                {apt.lab_status.isReady ? 'Lab Result Ready' : 'Lab In Progress'}
                                                            </span>
                                                        )}

                                                        {/* Dynamic Billing Status Badges */}
                                                        {apt.invoiceStatus === 'paid' ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[9px] bg-emerald-500 text-white font-black uppercase tracking-wider shadow-sm shadow-emerald-200">Discharged / Paid</span>
                                                        ) : apt.invoiceStatus === 'pending' ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[9px] bg-amber-500 text-white font-black uppercase tracking-wider shadow-sm shadow-amber-200">Billing / Draft</span>
                                                        ) : (
                                                            selectedTab === 'history' && (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] bg-slate-500 text-white font-black uppercase tracking-wider">Processed</span>
                                                            )
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                                                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md"><User className="h-3.5 w-3.5 text-slate-400" /> {apt.patient_gender}, {apt.patient_age} Years</span>
                                                        <span className="hidden xl:inline text-slate-300">|</span>
                                                        <span className="hidden xl:inline text-slate-400">ID: <span className="text-slate-600 font-mono">#{apt.patient_id || 'N/A'}</span></span>
                                                        {apt.blood_group && (
                                                            <span className="text-red-500 font-black bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md text-[10px] border border-red-100 dark:border-red-900/30">{apt.blood_group}</span>
                                                        )}
                                                    </div>

                                                    {apt.reason && (
                                                        <div className="flex items-start gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                                            <span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold mt-0.5">Reason:</span> {apt.reason}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Button */}
                                                <div className="flex flex-col gap-2 mt-2 xl:mt-0 xl:min-w-[200px]">
                                                    <button
                                                        onClick={() => router.push(`/hms/prescriptions/new?appointmentId=${apt.id}&patientId=${apt.patient_uuid}`)}
                                                        className={`h-11 w-full rounded-xl font-black text-xs shadow-xl transition-all flex items-center justify-center gap-2 group-hover:ring-2 ring-blue-500/20 hover:scale-[1.02] active:scale-95
                                                        ${apt.status === 'completed'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 shadow-emerald-900/5'
                                                                : 'bg-slate-900 text-white hover:bg-blue-600 dark:bg-white dark:text-slate-900 dark:hover:bg-blue-500 dark:hover:text-white shadow-slate-900/10 hover:shadow-blue-600/20'}
                                                    `}
                                                    >
                                                        {apt.status === 'completed' ? (
                                                            <>
                                                                <FileText className="h-4 w-4" />
                                                                VIEW Rx / SUMMARY
                                                            </>
                                                        ) : (apt.status === 'in_progress' || apt.status === 'confirmed') ? (
                                                            <>
                                                                <Activity className="h-4 w-4" />
                                                                RESUME CONSULT
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Stethoscope className="h-4 w-4" />
                                                                START CONSULT
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* NEW: Scan Rx Button */}
                                                    {apt.status !== 'completed' && (
                                                        <button
                                                            onClick={() => openScanner(apt.patient_uuid, apt.patient_name, apt.id)}
                                                            className="h-10 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Smartphone className="h-4 w-4" />
                                                            SCAN RX (AiScanner)
                                                        </button>
                                                    )}

                                                    {apt.lab_status && apt.lab_status.isReady && (
                                                        <Link
                                                            href={`/hms/lab/reports/${apt.lab_status.orderId}`}
                                                            className="h-10 w-full rounded-xl bg-violet-50 text-violet-700 font-bold text-xs border border-violet-100 hover:bg-violet-100 hover:border-violet-200 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            VIEW LAB REPORT
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>


            {/* Scanner Modal */}
            {
                selectedPatientForScan && (
                    <ScannerModal
                        isOpen={isScannerOpen}
                        onClose={() => setIsScannerOpen(false)}
                        doctorName={doctorName}
                        doctorId={doctorId}
                        patientId={selectedPatientForScan.id}
                        patientName={selectedPatientForScan.name}
                        appointmentId={selectedPatientForScan.appointmentId}
                    />
                )
            }
        </div >
    )
}
