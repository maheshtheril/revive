import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { DoctorDashboardClient } from "@/components/hms/doctor/doctor-dashboard-client"
import { ensureHmsMenus } from "@/lib/menu-seeder"

import { initializeDoctorProfile } from "@/app/actions/doctor"
import { Stethoscope, CheckCircle2 } from "lucide-react"
import { InitializeProfileButton } from "@/components/hms/doctor/initialize-profile-button"

export const dynamic = 'force-dynamic'

export default async function DoctorDashboardPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
    const params = await searchParams
    const dateStr = params.date as string
    const targetDate = dateStr ? new Date(dateStr) : new Date()

    await ensureHmsMenus()
    const session = await auth()

    if (!session?.user?.email) {
        redirect("/login")
    }

    const tenantId = session.user.tenantId
    const userEmail = session.user.email

    // 1. Identify the Clinician (World-Class Profile Linking)
    // Preference: user_id > email
    let clinician = await prisma.hms_clinicians.findFirst({
        where: {
            user_id: session.user.id,
            tenant_id: tenantId
        }
    })

    if (!clinician) {
        // Fallback: Check by email (for legacy/unlinked accounts)
        clinician = await prisma.hms_clinicians.findFirst({
            where: {
                email: { equals: userEmail, mode: 'insensitive' },
                tenant_id: tenantId
            }
        })
    }

    if (!clinician) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white">
                        <div className="h-16 w-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Stethoscope className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-black">Welcome to Clinician Portal</h2>
                        <p className="text-blue-100 mt-2">Let's set up your institutional profile.</p>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="text-slate-500 text-sm">
                            <p>We found your account <strong>{userEmail}</strong> but it's not linked to a clinical profile yet.</p>
                            <p className="mt-2">Click below to automatically create your profile and access the dashboard.</p>
                        </div>

                        <InitializeProfileButton />
                    </div>
                </div>
            </div>
        )
    }

    // 2. [ELITE DATE DYNAMIC RANGE] Adjusted to target specific date from URL
    const todayStart = new Date(targetDate)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(targetDate)
    todayEnd.setHours(23, 59, 59, 999)

    const appointments = await prisma.hms_appointments.findMany({
        where: {
            clinician_id: clinician.id,
            tenant_id: tenantId,
            starts_at: {
                gte: todayStart,
                lte: todayEnd
            },
            status: { not: 'cancelled' } // viewing active ones
        },
        include: {
            hms_patient: true,
            hms_invoice: {
                select: { status: true }
            }
        },
        orderBy: {
            starts_at: 'asc'
        }
    })

    // 3. Check Vitals Status
    const appointmentIds = appointments.map(a => a.id)
    const vitals = await prisma.hms_vitals.findMany({
        where: {
            encounter_id: { in: appointmentIds }
        },
        select: {
            encounter_id: true
        }
    })
    const vitalsSet = new Set(vitals.map(v => v.encounter_id))

    // 4. Check Lab Results Status
    const labs = await prisma.hms_lab_order.findMany({
        where: {
            encounter_id: { in: appointmentIds }
        },
        select: {
            id: true,
            encounter_id: true,
            status: true,
            report_url: true
        }
    })

    // Create a map for easy lookup: appointmentId -> { hasLab: true, isReady: true, url: ... }
    const labMap = new Map()
    labs.forEach(lab => {
        if (!lab.encounter_id) return
        // If there are multiple orders, we prioritize completed ones with reports
        const existing = labMap.get(lab.encounter_id)
        const isCompleted = lab.status === 'completed' && !!lab.report_url

        if (!existing || (isCompleted && !existing.isReady)) {
            labMap.set(lab.encounter_id, {
                hasLab: true,
                isReady: isCompleted,
                reportUrl: lab.report_url,
                orderId: lab.id
            })
        }
    })

    // 5. Fetch Tags
    const tags = await prisma.hms_appointment_tags.findMany({
        where: { appointment_id: { in: appointmentIds } }
    })
    const tagsMap: Record<string, string[]> = {}
    tags.forEach(t => {
        if (!tagsMap[t.appointment_id]) tagsMap[t.appointment_id] = []
        tagsMap[t.appointment_id].push(t.tag)
    })

    // 6. Transform Data
    const formattedAppointments = appointments.map(apt => {
        const isVitalsDone = vitalsSet.has(apt.id)

        return {
            id: apt.id,
            time: apt.starts_at,
            status: apt.status,
            patient_name: `${apt.hms_patient.first_name} ${apt.hms_patient.last_name || ''}`.trim(),
            patient_id: apt.hms_patient.patient_number,
            patient_uuid: apt.patient_id,
            patient_gender: apt.hms_patient.gender || 'Unknown',
            patient_age: apt.hms_patient.dob
                ? new Date().getFullYear() - new Date(apt.hms_patient.dob).getFullYear()
                : 0,
            blood_group: (apt.hms_patient as any).blood_group, // Cast as any if simple typing misses it
            reason: apt.notes || apt.type,
            priority: apt.priority,
            type: apt.type,
            tags: tagsMap[apt.id] || [],
            vitals_done: isVitalsDone,
            lab_status: labMap.get(apt.id) || null,
            // @ts-ignore
            working_days: (apt as any).working_days || [],
            invoiceStatus: apt.hms_invoice?.length > 0
                ? (apt.hms_invoice.every((i: any) => i.status === 'paid') ? 'paid' : 'pending')
                : 'none'
        }
    })

    // 5. Calculate Stats
    const stats = {
        total: appointments.length,
        waiting: formattedAppointments.filter(a => a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'arrived').length,
        completed: formattedAppointments.filter(a => a.status === 'completed').length
    }

    return (
        <DoctorDashboardClient
            doctorName={`${clinician.salutation || 'Dr.'} ${clinician.first_name} ${clinician.last_name}`}
            doctorId={session.user.id}
            appointments={formattedAppointments}
            stats={stats}
        />
    )
}
