'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { serialize } from "@/lib/utils"
import { revalidatePath } from "next/cache"

/**
 * Ensures an appointment has a sequential token number based on CHRONOLOGICAL order.
 * The 9:00 AM patient is ALWAYS #1, regardless of when they are printed.
 */
export async function ensureAppointmentToken(appointmentId: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        return await prisma.$transaction(async (tx) => {
            const targetApt = await tx.hms_appointments.findUnique({
                where: { id: appointmentId },
                include: { hms_patient: true, hms_clinician: true }
            })

            if (!targetApt) throw new Error("Appointment not found")
            if (targetApt.token_number) return { success: true, data: serialize(targetApt) }

            const doctorId = targetApt.clinician_id
            if (!doctorId) throw new Error("Clinician not assigned")

            const dateStr = targetApt.starts_at.toISOString().split('T')[0]
            const startOfDay = new Date(`${dateStr}T00:00:00Z`)
            const endOfDay = new Date(`${dateStr}T23:59:59Z`)

            // 1. Lock the doctor's day
            const lockId = Math.abs(parseInt(doctorId.replace(/[^0-9]/g, '').slice(-6) || '0') + 
                           parseInt(dateStr.replace(/-/g, '').slice(-6)));
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`

            // 2. Fetch all appointments for this doctor/day in CHRONOLOGICAL order
            const allDayApts = await tx.hms_appointments.findMany({
                where: {
                    tenant_id: session.user.tenantId,
                    clinician_id: doctorId,
                    starts_at: { gte: startOfDay, lte: endOfDay },
                    status: { not: 'cancelled' },
                    deleted_at: null
                },
                orderBy: { starts_at: 'asc' }
            })

            // 3. Assign sequential tokens based on time slot
            let targetUpdated = null;
            for (let i = 0; i < allDayApts.length; i++) {
                const apt = allDayApts[i];
                const expectedToken = i + 1;
                
                if (apt.token_number !== expectedToken) {
                    const up = await tx.hms_appointments.update({
                        where: { id: apt.id },
                        data: { token_number: expectedToken },
                        include: { hms_patient: true, hms_clinician: true }
                    });
                    if (apt.id === appointmentId) targetUpdated = up;
                } else if (apt.id === appointmentId) {
                    targetUpdated = await tx.hms_appointments.findUnique({
                        where: { id: apt.id },
                        include: { hms_patient: true, hms_clinician: true }
                    });
                }
            }

            revalidatePath('/hms/reception/dashboard')
            return { success: true, data: serialize(targetUpdated) }
        })
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createAppointment(data: any) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const appointment = await prisma.hms_appointments.create({
            data: {
                ...data,
                tenant_id: session.user.tenantId,
                status: 'scheduled',
                created_by: session.user.id
            }
        })
        revalidatePath('/hms/reception/dashboard')
        return { success: true, data: serialize(appointment) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateAppointmentDetails(id: string, data: any) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const appointment = await prisma.hms_appointments.update({
            where: { id },
            data
        })
        revalidatePath('/hms/reception/dashboard')
        return { success: true, data: serialize(appointment) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateAppointmentStatus(id: string, status: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const appointment = await prisma.hms_appointments.update({
            where: { id },
            data: { status }
        })
        revalidatePath('/hms/reception/dashboard')
        return { success: true, data: serialize(appointment) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteAppointment(id: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        await prisma.hms_appointments.update({
            where: { id },
            data: { deleted_at: new Date() }
        })
        revalidatePath('/hms/reception/dashboard')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getClinicianAppointments(clinicianId: string, date: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const startOfDay = new Date(`${date}T00:00:00+05:30`)
        const endOfDay = new Date(`${date}T23:59:59+05:30`)

        const appointments = await prisma.hms_appointments.findMany({
            where: {
                tenant_id: session.user.tenantId,
                clinician_id: clinicianId,
                starts_at: { gte: startOfDay, lte: endOfDay },
                status: { not: 'cancelled' },
                deleted_at: null
            },
            include: {
                hms_patient: true
            },
            orderBy: { starts_at: 'asc' }
        })

        return { success: true, data: serialize(appointments) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAppointmentsProp(start: Date, end: Date) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    const isAdmin = session.user.isAdmin || (session.user as any).isTenantAdmin;

    try {
        const appointments = await prisma.hms_appointments.findMany({
            where: {
                tenant_id: session.user.tenantId,
                ...(!isAdmin && { created_by: session.user.id }),
                starts_at: { gte: start, lte: end },
                deleted_at: null
            },
            include: {
                hms_patient: true,
                hms_clinician: true
            }
        })

        const mapped = appointments.map(apt => ({
            id: apt.id,
            title: `${apt.hms_patient?.first_name || 'Unknown'} ${apt.hms_patient?.last_name || ''} - ${apt.type || 'Appointment'}`,
            start: apt.starts_at,
            end: apt.ends_at || apt.starts_at,
            resource: {
                status: apt.status,
                type: apt.type
            }
        }))

        return { success: true, data: serialize(mapped) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateAppointmentDate(id: string, start: Date, end: Date) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const appointment = await prisma.hms_appointments.update({
            where: { id },
            data: {
                starts_at: start,
                ends_at: end
            }
        })
        revalidatePath('/hms/appointments')
        revalidatePath('/hms/reception/dashboard')
        return { success: true, data: serialize(appointment) }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
