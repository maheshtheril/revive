'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { serialize } from "@/lib/utils"

export async function saveVitals(data: {
    tenantId: string
    patientId: string
    encounterId: string
    height?: string
    weight?: string
    temperature?: string
    pulse?: string
    systolic?: string
    diastolic?: string
    spo2?: string
    respiration?: string
    notes?: string
}) {
    try {
        const session = await auth()
        if (!session?.user) {
            return { success: false, error: 'Unauthorized' }
        }

        const {
            tenantId,
            patientId,
            encounterId,
            height,
            weight,
            temperature,
            pulse,
            systolic,
            diastolic,
            spo2,
            respiration,
            notes
        } = data

        // Manual Upsert to genericize nullable unique constraint handling
        const existing = await prisma.hms_vitals.findFirst({
            where: { encounter_id: encounterId }
        })

        if (existing) {
            await prisma.hms_vitals.update({
                where: { id: existing.id },
                data: {
                    height: height ? parseFloat(height) : null,
                    weight: weight ? parseFloat(weight) : null,
                    temperature: temperature ? parseFloat(temperature) : null,
                    pulse: pulse ? parseInt(pulse) : null,
                    systolic: systolic ? parseInt(systolic) : null,
                    diastolic: diastolic ? parseInt(diastolic) : null,
                    spo2: spo2 ? parseInt(spo2) : null,
                    respiration: respiration ? parseInt(respiration) : null,
                    notes: notes || null
                }
            })
        } else {
            // Use raw SQL to get actual error message
            await prisma.$executeRaw`
                INSERT INTO hms_vitals (
                    id, tenant_id, company_id, patient_id, encounter_id,
                    height, weight, temperature, pulse, systolic, diastolic, spo2, respiration, notes
                ) VALUES (
                    gen_random_uuid(),
                    ${tenantId}::uuid,
                    ${session.user.companyId || tenantId}::uuid,
                    ${patientId}::uuid,
                    ${encounterId}::uuid,
                    ${height ? parseFloat(height) : null},
                    ${weight ? parseFloat(weight) : null},
                    ${temperature ? parseFloat(temperature) : null},
                    ${pulse ? parseInt(pulse) : null},
                    ${systolic ? parseInt(systolic) : null},
                    ${diastolic ? parseInt(diastolic) : null},
                    ${spo2 ? parseInt(spo2) : null},
                    ${respiration ? parseInt(respiration) : null},
                    ${notes || null}
                )
            `
        }

        // Auto-update appointment status if it's currently 'scheduled'
        // This ensures the reception dashboard shows "Waiting" instead of "Upcoming"
        const appointment = await prisma.hms_appointments.findUnique({
            where: { id: encounterId },
            select: { status: true }
        })

        if (appointment && appointment.status === 'scheduled') {
            await prisma.hms_appointments.update({
                where: { id: encounterId },
                data: { status: 'arrived' }
            })
        }

        revalidatePath('/hms/nursing')
        revalidatePath(`/hms/nursing/` + encounterId)
        revalidatePath('/hms/doctor/dashboard')
        revalidatePath('/hms/reception/dashboard')

        return { success: true }
    } catch (error) {
        console.error('Save Vitals Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save vitals'
        }
    }
}

export async function getVitals(encounterId: string) {
    try {
        const session = await auth()
        if (!session?.user) return null

        const vitals = await prisma.hms_vitals.findFirst({
            where: { encounter_id: encounterId }
        })

        if (!vitals) return null

        // Explicitly map fields to avoid any recursive serialization issues
        // converting Decimals to Numbers manually here
        return {
            ...vitals,
            height: vitals.height ? Number(vitals.height) : null,
            weight: vitals.weight ? Number(vitals.weight) : null,
            temperature: vitals.temperature ? Number(vitals.temperature) : null,
            pulse: vitals.pulse ? Number(vitals.pulse) : null,
            systolic: vitals.systolic ? Number(vitals.systolic) : null,
            diastolic: vitals.diastolic ? Number(vitals.diastolic) : null,
            spo2: vitals.spo2 ? Number(vitals.spo2) : null,
            respiration: vitals.respiration ? Number(vitals.respiration) : null,
            recorded_at: vitals.recorded_at ? vitals.recorded_at.toISOString() : null
        }
    } catch (error) {
        console.error('Fetch Vitals Error:', error)
        return null
    }
}
