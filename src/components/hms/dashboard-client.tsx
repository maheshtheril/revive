'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import {
    Users, Calendar, Activity, IndianRupee, Plus, Search,
    Filter, MoreHorizontal, Clock, MapPin, Video, Phone,
    CheckCircle2, XCircle, AlertCircle, Stethoscope, Receipt
} from "lucide-react"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { CreatePatientForm } from "@/components/hms/create-patient-form"

interface DashboardClientProps {
    user: any
    stats: {
        totalPatients: number
        todayAppointments: number
        pendingBills: number
        revenue: number
    }
    appointments: any[]
    patients: any[]
    doctors: any[]
    tenant?: any
    company?: any
}

export function DashboardClient({ user, stats, appointments, patients, doctors, tenant, company }: DashboardClientProps) {
    const [showAppointmentModal, setShowAppointmentModal] = useState(false)
    const [mounted, setMounted] = useState(false)
    
    // Fix Hydration mismatch on locale strings
    useEffect(() => { setMounted(true) }, [])

    const pendingApts = (appointments || []).filter(a => a?.status?.toLowerCase() === 'scheduled' || a?.status?.toLowerCase() === 'pending').length
    const dashboardTitle = company?.name || tenant?.app_name || 'Dashboard'

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Top Navigation / Header */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-800">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tighter leading-tight">
                                    {dashboardTitle}
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                                    Welcome back, {user?.name || 'User'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/hms/analytics"
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-all text-sm font-bold shadow-sm"
                            >
                                <Activity className="h-4 w-4" />
                                View Analytics
                            </Link>
                            <button
                                onClick={() => setShowAppointmentModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:ring-2 hover:ring-blue-500/20 transition-all text-sm font-bold active:scale-95 shadow-lg shadow-blue-500/20"
                            >
                                <Calendar className="h-4 w-4" />
                                OP Booking/Registration
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link href="/hms/patients" className="block transition-transform hover:scale-[1.02]">
                        <StatsCard
                            title="Total Patients"
                            value={stats.totalPatients.toString()}
                            icon={Users}
                            trend="Registered in system"
                            color="blue"
                        />
                    </Link>
                    <Link href="/hms/appointments" className="block transition-transform hover:scale-[1.02]">
                        <StatsCard
                            title="Today's Appointments"
                            value={stats.todayAppointments.toString()}
                            icon={Calendar}
                            trend={`${pendingApts} upcoming`}
                            color="indigo"
                            highlight
                        />
                    </Link>
                    <Link href="/hms/billing?status=pending" className="block transition-transform hover:scale-[1.02]">
                        <StatsCard
                            title="Pending Bills"
                            value={stats.pendingBills.toString()}
                            icon={Activity}
                            trend="Invoices to process"
                            color="orange"
                        />
                    </Link>
                    <Link href="/hms/billing" className="block transition-transform hover:scale-[1.02]">
                        <StatsCard
                            title="Total Revenue"
                            value={mounted ? `₹${stats.revenue.toLocaleString('en-IN')}` : `₹${stats.revenue}`}
                            icon={IndianRupee}
                            trend="Monthly collection"
                            color="green"
                        />
                    </Link>
                </div>

                {/* CRITICAL: Pending Actions Section (Receptionist View) */}
                {stats.pendingBills > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex gap-4">
                            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Receipt className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Action Required: {stats.pendingBills} Draft Invoices</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    You have draft bills waiting to be finalized. Please review and process them.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/hms/billing?status=draft"
                            className="whitespace-nowrap px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2"
                        >
                            View Drafts <Clock className="h-4 w-4" />
                        </Link>
                    </div>
                )}

                {/* Highlighted Appointment Table Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Link href="/hms/appointments" className="hover:text-indigo-600 transition-colors">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-500" />
                                Today's Schedule
                            </h2>
                        </Link>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search appointments..."
                                    className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all hover:bg-gray-50 dark:hover:bg-slate-800"
                                />
                            </div>
                            <button className="p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors">
                                <Filter className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-indigo-100/20 dark:shadow-none border border-gray-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400">Time</th>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400">Patient</th>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400">Doctor</th>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400">Type</th>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-4 font-semibold text-gray-500 dark:text-slate-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {appointments.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                                No appointments scheduled for today
                                            </td>
                                        </tr>
                                    ) : (
                                        appointments.map((apt: any) => (
                                            <tr
                                                key={apt.id}
                                                className="group hover:bg-blue-50/50 dark:hover:bg-indigo-900/10 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                                    {mounted ? new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(apt.starts_at).toISOString().split('T')[1].substring(0, 5)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">
                                                            {apt.patient.first_name?.[0]}{apt.patient.last_name?.[0] || ''}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                                {apt.patient.first_name} {apt.patient.last_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-slate-400">
                                                                {apt.patient.patient_number}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                                                    Dr. {apt.clinician?.first_name} {apt.clinician?.last_name}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {apt.notes?.toLowerCase()?.includes('video') ? (
                                                            <Video className="h-3.5 w-3.5 text-purple-500" />
                                                        ) : (
                                                            <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                                        )}
                                                        <span className="text-gray-600 dark:text-slate-300 capitalize">
                                                            {apt.type || 'Consultation'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <StatusBadge status={apt.status} />
                                                        <div className="flex flex-wrap gap-1">
                                                            {apt.prescription && apt.prescription.length > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                                                    <Stethoscope className="h-2.5 w-2.5" /> Rx Done
                                                                </span>
                                                            )}
                                                            {apt.hms_invoice && apt.hms_invoice.length > 0 ? (
                                                                apt.hms_invoice.some((inv: any) => inv.status === 'paid') ? (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                                        <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                                        <Receipt className="h-2.5 w-2.5" /> Bill Pending
                                                                    </span>
                                                                )
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 sm:gap-2 whitespace-nowrap">
                                                        {apt.prescription && apt.prescription.length > 0 ? (
                                                            <Link
                                                                href={`/hms/prescriptions/new?patientId=${apt.patient_id}&appointmentId=${apt.id}`}
                                                                className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold transition-all hover:bg-indigo-700 shadow-sm"
                                                                title="Edit Prescription"
                                                            >
                                                                Edit Rx
                                                            </Link>
                                                        ) : (
                                                            <Link
                                                                href={`/hms/prescriptions/new?patientId=${apt.patient_id}&appointmentId=${apt.id}`}
                                                                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                                title="Prescribe"
                                                            >
                                                                <Stethoscope className="h-4 w-4" />
                                                            </Link>
                                                        )}
                                                        <Link
                                                            href={`/hms/billing/new?patientId=${apt.patient_id}&appointmentId=${apt.id}`}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                                                            title="Create Bill"
                                                        >
                                                            <IndianRupee className="h-4 w-4" />
                                                        </Link>
                                                        <button className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </main>

            {/* Modals */}
            {showAppointmentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowAppointmentModal(false)}
                    ></div>
                    <div className="relative bg-white dark:bg-slate-950 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800">
                        <div className="h-full overflow-y-auto">
                            <AppointmentForm
                                patients={patients}
                                doctors={doctors}
                                appointments={appointments}
                                onClose={() => setShowAppointmentModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatsCard({ title, value, icon: Icon, trend, color, highlight = false }: any) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
        green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    } as any

    return (
        <div className={`
            relative overflow-hidden p-6 rounded-2xl border transition-all duration-300
            ${highlight
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/30'
                : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:shadow-lg hover:border-gray-200 dark:hover:border-slate-700'
            }
        `}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className={`text-sm font-medium mb-1 ${highlight ? 'text-indigo-100' : 'text-gray-500 dark:text-slate-400'}`}>
                        {title}
                    </p>
                    <h3 className={`text-3xl font-bold ${highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {value}
                    </h3>
                </div>
                <div className={`p-3 rounded-xl ${highlight ? 'bg-white/20 text-white' : colors[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
            <div className={`flex items-center text-xs font-medium ${highlight ? 'text-indigo-100' : 'text-gray-500 dark:text-slate-400'}`}>
                {trend}
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status?: string }) {
    const safeStatus = status?.toLowerCase() || 'pending'
    const styles = {
        scheduled: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
        completed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
        cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
        pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    } as any

    const icons = {
        scheduled: Clock,
        completed: CheckCircle2,
        cancelled: XCircle,
        pending: AlertCircle,
    } as any

    const StatusIcon = icons[safeStatus] || Clock

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[safeStatus] || styles.pending}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span className="capitalize">{status || 'Pending'}</span>
        </span>
    )
}
