'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { serialize } from "@/lib/utils"

export type TimelineEventType =
    | 'REGISTRATION'
    | 'APPOINTMENT'
    | 'ADMISSION'
    | 'VITALS'
    | 'PRESCRIPTION'
    | 'LAB_ORDER'
    | 'DISCHARGE'
    | 'BILLING'
    | 'CONSUMABLES'

export interface TimelineEvent {
    id: string
    type: TimelineEventType
    date: Date
    title: string
    description: string
    metadata: any
}

export async function getPatientTimeline(patientId: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const tenantId = session.user.tenantId

        // Fetch everything in parallel for maximum performance
        const [
            patient,
            appointments,
            admissions,
            vitals,
            prescriptions,
            labOrders,
            invoices,
            stockMoves
        ] = await Promise.all([
            prisma.hms_patient.findUnique({ where: { id: patientId, tenant_id: tenantId } }),
            prisma.hms_appointments.findMany({ where: { patient_id: patientId, tenant_id: tenantId }, orderBy: { starts_at: 'desc' } }),
            prisma.hms_admission.findMany({ where: { patient_id: patientId, tenant_id: tenantId }, orderBy: { admitted_at: 'desc' } }),
            prisma.hms_vitals.findMany({ where: { patient_id: patientId, tenant_id: tenantId }, orderBy: { recorded_at: 'desc' } }),
            prisma.$queryRaw`SELECT * FROM prescription WHERE patient_id::text = ${patientId} ORDER BY created_at DESC` as Promise<any[]>,
            prisma.hms_lab_order.findMany({ where: { patient_id: patientId, tenant_id: tenantId }, include: { hms_lab_order_line: { include: { hms_lab_test: true } } }, orderBy: { ordered_at: 'desc' } }),
            prisma.hms_invoice.findMany({ where: { patient_id: patientId, tenant_id: tenantId }, orderBy: { issued_at: 'desc' } }),
            // Fetch consumed assets / nursing usage specifically
            prisma.hms_stock_ledger.findMany({
                where: {
                    tenant_id: tenantId,
                    movement_type: 'out',
                    reference: { contains: patientId }
                },
                include: { hms_product: true },
                orderBy: { created_at: 'desc' }
            })
        ])

        if (!patient) return { success: false, error: "Patient not found" }

        const events: TimelineEvent[] = []

        // 1. Registration
        events.push({
            id: 'reg-' + patient.id,
            type: 'REGISTRATION',
            date: patient.created_at || new Date(),
            title: 'Patient Registered',
            description: `Registered with ID: ${patient.patient_number || 'N/A'}`,
            metadata: { name: `${patient.first_name} ${patient.last_name}` }
        })

        // 2. Appointments
        appointments.forEach(app => {
            events.push({
                id: app.id,
                type: 'APPOINTMENT',
                date: app.starts_at,
                title: 'Clinical Consultation',
                description: `Type: ${app.type || 'General Checkup'}`,
                metadata: { status: app.status, clinician_id: app.clinician_id }
            })
        })

        // 3. Admissions & Discharges
        admissions.forEach(adm => {
            events.push({
                id: adm.id,
                type: 'ADMISSION',
                date: adm.admitted_at,
                title: 'Hospital Admission',
                description: `Ward: ${adm.ward || 'N/A'} | Bed: ${adm.bed || 'N/A'}`,
                metadata: { status: adm.status, ward: adm.ward, bed: adm.bed }
            })

            if (adm.discharged_at) {
                events.push({
                    id: 'dis-' + adm.id,
                    type: 'DISCHARGE',
                    date: adm.discharged_at,
                    title: 'Hospital Discharge',
                    description: `Discharged from ${adm.ward || 'N/A'}`,
                    metadata: { summary: (adm.metadata as any)?.discharge_summary }
                })
            }
        })

        // 4. Vitals
        vitals.forEach(v => {
            events.push({
                id: v.id,
                type: 'VITALS',
                date: v.recorded_at || new Date(),
                title: 'Vitals Recorded',
                description: `Temp: ${v.temperature}°F, Pulse: ${v.pulse}bpm, BP: ${v.systolic}/${v.diastolic}`,
                metadata: v
            })
        })

        // 5. Prescriptions
        prescriptions.forEach(p => {
            events.push({
                id: p.id,
                type: 'PRESCRIPTION',
                date: p.created_at,
                title: 'Medical Prescription',
                description: `Diagnosis: ${p.diagnosis || 'N/A'}`,
                metadata: { diagnosis: p.diagnosis, plan: p.plan }
            })
        })

        // 6. Lab Orders
        labOrders.forEach(lo => {
            events.push({
                id: lo.id,
                type: 'LAB_ORDER',
                date: lo.ordered_at || new Date(),
                title: 'Lab Investigation Ordered',
                description: `${lo.hms_lab_order_line.length} tests requested (${lo.order_number})`,
                metadata: { status: lo.status, tests: lo.hms_lab_order_line.map(l => l.hms_lab_test?.name) }
            })
        })

        // 7. Billing
        invoices.forEach(inv => {
            events.push({
                id: inv.id,
                type: 'BILLING',
                date: inv.issued_at,
                title: 'Invoice Issued',
                description: `Inv: ${inv.invoice_number} | Total: ${inv.currency} ${inv.total}`,
                metadata: { status: inv.status, total: inv.total }
            })
        })

        // 8. Consumables Usage
        stockMoves.forEach(mv => {
            events.push({
                id: mv.id,
                type: 'CONSUMABLES',
                date: mv.created_at || new Date(),
                title: 'Consumable Used',
                description: `${mv.qty} ${mv.uom} of ${mv.hms_product?.name || 'Item'} consumed`,
                metadata: {
                    product_id: mv.product_id,
                    product_name: mv.hms_product?.name,
                    notes: (mv.metadata as any)?.notes
                }
            })
        })

        // Sort all events by date descending
        events.sort((a, b) => b.date.getTime() - a.date.getTime())

        return { success: true, data: serialize(events), patient: serialize(patient) }
    } catch (err: any) {
        console.error("Timeline Error:", err)
        return { success: false, error: err.message }
    }
}
