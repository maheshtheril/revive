import Link from "next/link"
import { Plus, Calendar, Sparkles, Zap, Filter } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

import SearchInput from "@/components/search-input"
import AppointmentsCalendar from "@/components/appointments/appointments-calendar"
import { AppointmentDialog, MobileAppointmentFab } from "@/components/appointments/appointment-dialog"
import { getBillableItems, getTaxConfiguration, getUoms } from "@/app/actions/billing";

export default async function AppointmentsPage() {
    const session = await auth()
    const tenantId = session?.user?.tenantId

    // Fetch real stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isAdmin = session?.user?.isAdmin || (session?.user as any)?.isTenantAdmin;

    const [
        todayCount,
        inProgressCount,
        weekStart,
        itemsRes,
        taxRes,
        uomsRes,
        companySettings
    ] = await Promise.all([
        prisma.hms_appointments.count({
            where: {
                tenant_id: tenantId,
                ...(!isAdmin && { created_by: session.user.id }),
                starts_at: {
                    gte: today,
                    lt: tomorrow
                }
            }
        }),
        prisma.hms_appointments.count({
            where: {
                tenant_id: tenantId,
                ...(!isAdmin && { created_by: session.user.id }),
                status: 'in_progress'
            }
        }),
        (() => {
            const ws = new Date()
            ws.setDate(ws.getDate() - ws.getDay())
            ws.setHours(0, 0, 0, 0)
            return ws
        })(),
        getBillableItems(),
        getTaxConfiguration(),
        getUoms(),
        prisma.company_settings.findFirst({
            where: { tenant_id: tenantId },
            include: { currencies: true }
        })
    ])

    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };
    const uoms = (uomsRes as any).success ? (uomsRes as any).data : [];
    const currency = companySettings?.currencies?.symbol || session?.user?.currencySymbol || '₹';

    // Fetch Patients and Doctors for the Modal
    const [patients, doctors] = await Promise.all([
        prisma.hms_patient.findMany({
            where: tenantId ? { 
                tenant_id: tenantId,
                ...(!isAdmin && { created_by: session.user.id })
            } : undefined,
            take: 100,
            orderBy: { updated_at: 'desc' },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                patient_number: true,
                dob: true,
                gender: true
            }
        }),
        prisma.hms_clinicians.findMany({
            where: {
                tenant_id: tenantId,
                is_active: true
            },
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
    ])

    const weekCount = await prisma.hms_appointments.count({
        where: {
            tenant_id: tenantId,
            ...(!isAdmin && { created_by: session.user.id }),
            starts_at: {
                gte: weekStart
            }
        }
    })

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* Standard Enterprise Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                            Appointments
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Manage patient appointments, schedules, and unavailability.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                        <AppointmentDialog
                            patients={patients}
                            doctors={doctors}
                            billableItems={billableItems}
                            taxConfig={taxConfig}
                            uoms={uoms}
                            currency={currency}
                        />
                    </div>
                </div>

                {/* Real Stats Cards */}
                {/* Real Stats Cards Compact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-slate-800 hover:shadow-lg hover:border-blue-300 transition-all duration-300 flex items-center gap-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0">
                            <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{todayCount}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Today's Appts</div>
                        </div>
                    </div>

                    <div className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-slate-800 hover:shadow-lg hover:border-green-300 transition-all duration-300 flex items-center gap-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{inProgressCount}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">In Progress</div>
                        </div>
                    </div>

                    <div className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-slate-800 hover:shadow-lg hover:border-purple-300 transition-all duration-300 flex items-center gap-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0">
                            <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{weekCount}</div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">This Week</div>
                        </div>
                    </div>
                </div>

                {/* Search & Filters Bar */}
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <SearchInput placeholder="🔍 Search patients, doctors, or appointment ID..." />
                        </div>
                        <button className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 flex items-center gap-2 transition-all">
                            <Filter className="h-4 w-4" />
                            Filters
                        </button>
                    </div>
                </div>

                {/* Calendar Container */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 shadow-2xl min-h-[600px]">
                    <AppointmentsCalendar />
                </div>
            </div>

            {/* Mobile Floating Action Button (FAB) - World Standard */}
            <MobileAppointmentFab
                patients={patients}
                doctors={doctors}
                billableItems={billableItems}
                taxConfig={taxConfig}
                uoms={uoms}
                currency={currency}
            />
        </div>
    )
}
