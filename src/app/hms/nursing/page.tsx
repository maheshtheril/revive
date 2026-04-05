import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { format } from "date-fns"
import { Activity, Clock, User, HeartPulse, CheckCircle2, ChevronRight, Search } from "lucide-react"

export const dynamic = 'force-dynamic'

import { DashboardDateFilter } from "@/components/hms/dashboard-date-filter"

export default async function NursingStationPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
    const params = await searchParams
    const dateStr = params.date as string
    const targetDate = dateStr ? new Date(dateStr) : new Date()

    const session = await auth()
    const tenantId = session?.user?.tenantId

    // [DYNAMIC TIMELINE] Get target date start/end instead of hardcoded today
    const selectedDate = new Date(targetDate)
    selectedDate.setHours(0, 0, 0, 0)
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Fetch appointments for selected date
    const appointments = await prisma.hms_appointments.findMany({
        where: {
            tenant_id: tenantId,
            starts_at: {
                gte: selectedDate,
                lt: tomorrow
            },
            status: {
                in: ['confirmed', 'arrived', 'checked_in', 'in_progress']
            }
        },
        include: {
            hms_patient: true,
            hms_clinician: true
        },
        orderBy: {
            starts_at: 'asc'
        }
    })

    // Fetch vitals status for these appointments to show "Done" or "Pending"
    const appointmentIds = appointments.map(a => a.id)
    const vitals = await prisma.hms_vitals.findMany({
        where: {
            encounter_id: { in: appointmentIds }
        },
        select: {
            encounter_id: true
        }
    })
    const vitalsDoneSet = new Set(vitals.map(v => v.encounter_id))

    const awaitingVitals = appointments.filter(a => !vitalsDoneSet.has(a.id))
    const completedVitals = appointments.filter(a => vitalsDoneSet.has(a.id))

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="h-12 w-12 bg-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        Nursing Station
                    </h1>
                    <p className="text-slate-500 font-medium ml-16 mt-1">Manage patient vitals and triage for today</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    <DashboardDateFilter />
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center w-full md:w-80">
                        <Search className="h-5 w-5 text-slate-400 ml-2" />
                        <input
                            type="text"
                            placeholder="Search patient..."
                            className="flex-1 border-none focus:ring-0 text-sm font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Patients</p>
                        <p className="text-4xl font-black text-slate-900 mt-2">{appointments.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                        <User className="h-6 w-6" />
                    </div>
                </div>
                <div className="bg-pink-50 p-6 rounded-3xl shadow-sm border border-pink-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-pink-400 uppercase tracking-widest">Pending Vitals</p>
                        <p className="text-4xl font-black text-pink-600 mt-2">{awaitingVitals.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-500 animate-pulse">
                        <HeartPulse className="h-6 w-6" />
                    </div>
                </div>
                <div className="bg-emerald-50 p-6 rounded-3xl shadow-sm border border-emerald-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Completed</p>
                        <p className="text-4xl font-black text-emerald-600 mt-2">{completedVitals.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Pending List */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-pink-500" />
                        Pending Assessment
                        <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs">{awaitingVitals.length}</span>
                    </h2>

                    {awaitingVitals.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                            <div className="inline-flex h-16 w-16 bg-slate-50 rounded-full items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">All Caught Up!</h3>
                            <p className="text-slate-500">No patients waiting for vitals check.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {awaitingVitals.map(apt => (
                                <Link
                                    href={`/hms/nursing/${apt.id}`}
                                    key={apt.id}
                                    className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-pink-500" />
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            {apt.hms_patient?.profile_image_url ? (
                                                <img src={apt.hms_patient.profile_image_url} alt="" className="h-12 w-12 rounded-full object-cover shadow-md" />
                                            ) : (
                                                <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                                                    {apt.hms_patient?.first_name?.[0]}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-pink-600 transition-colors">
                                                    {apt.hms_patient?.first_name} {apt.hms_patient?.last_name}
                                                </h3>
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                    {format(new Date(apt.starts_at), 'hh:mm a')} • Dr. {apt.hms_clinician?.first_name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-6">
                                        <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-pink-500 animate-pulse" />
                                            Awaiting Vitals
                                        </span>
                                        <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-all">
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Completed List (Compact) */}
                {completedVitals.length > 0 && (
                    <div className="pt-8 border-t border-slate-200">
                        <h2 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" />
                            Completed Today
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {completedVitals.map(apt => (
                                <Link
                                    href={`/hms/nursing/${apt.id}`}
                                    key={apt.id}
                                    className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between opacity-60 hover:opacity-100 hover:bg-white hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm">
                                            {apt.hms_patient?.first_name} {apt.hms_patient?.last_name}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">DONE</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
