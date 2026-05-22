'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/utils"

/**
 * getInitialInvoiceData - THE "BATTLE-HARDENED" CLINICAL DISCOVERY ENGINE
 * 
 * Version 6.0: Batch-Aware Synchronization
 * Implements World Standard clinical tracking by capturing Batch IDs and Expiry Dates 
 * for nursing consumables and medical administrations.
 */

const isUUID = (id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id));

export type TimelineEvent = {
    id: string;
    type: 'REGISTRATION' | 'APPOINTMENT' | 'ADMISSION' | 'VITALS' | 'PRESCRIPTION' | 'LAB_ORDER' | 'DISCHARGE' | 'BILLING' | 'CONSUMABLES';
    title: string;
    description: string;
    date: Date;
    metadata: any;
};

export async function getInitialInvoiceData(encounterId?: string, patientId?: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { error: "SECURITY_AUTH_EXPIRED" };

    const sweepWindow = new Date();
    sweepWindow.setDate(sweepWindow.getDate() - 30); // 30-day "Medical Day" sweep

    try {
        console.log(`[CLINICAL-SYNC] Investigating ID/Ref: ${patientId || 'none'} | Encounter: ${encounterId || 'none'}`);

        // 1. SMART IDENTITY RESOLUTION
        let resolvedPatientId = patientId;
        if (patientId && !isUUID(patientId)) {
            const resolved = await prisma.hms_patient.findFirst({
                where: { 
                    tenant_id: tenantId,
                    OR: [
                        { patient_number: patientId },
                        { first_name: { contains: patientId, mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            });
            resolvedPatientId = resolved?.id;
        }

        if (!resolvedPatientId && encounterId && isUUID(encounterId)) {
            const apt = await prisma.hms_appointments.findUnique({
                where: { id: encounterId as any },
                select: { patient_id: true }
            });
            resolvedPatientId = apt?.patient_id || undefined;
        }

        if (!resolvedPatientId || !isUUID(resolvedPatientId)) return { success: true, data: { hubs: [] } };

        // 2. DISCOVER ALL RELEVANT ENCOUNTERS
        const recentEncounters = await prisma.hms_appointments.findMany({
            where: { 
                patient_id: resolvedPatientId, 
                tenant_id: tenantId,
                starts_at: { gte: sweepWindow }
            },
            select: { id: true }
        });
        const encounterIds = recentEncounters.map(e => e.id);
        if (encounterId && isUUID(encounterId) && !encounterIds.includes(encounterId)) encounterIds.push(encounterId);

        // 3. REVENUE PROTECTION
        const existingLines = await prisma.hms_invoice_lines.findMany({
            where: {
                tenant_id: tenantId,
                hms_invoice: {
                    patient_id: resolvedPatientId,
                    status: { in: ['draft', 'posted', 'paid'] as any[] }
                }
            },
            select: { metadata: true }
        });
        
        const billedSourceIds = new Set<string>();
        existingLines.forEach(l => {
            const sid = (l.metadata as any)?.sourceId;
            if (sid) billedSourceIds.add(String(sid));
        });

        const hubs: any[] = [];

        // --- HUB 1: NURSING HUB (Batch-Aware Sweep) ---
        const stockMoves = await prisma.hms_stock_move.findMany({
            where: {
                tenant_id: tenantId,
                source: { in: ['Nursing Consumption (Pending)', 'Nursing Consumption'] as any[] },
                source_reference: { in: encounterIds as any[] }
            },
            include: {
                hms_product_batch: true // FETCH BATCH DETAILS
            }
        });

        if (stockMoves.length > 0) {
            const moveProductIds = Array.from(new Set(stockMoves.map(m => m.product_id)));
            const moveProducts = await prisma.hms_product.findMany({
                where: { id: { in: moveProductIds } }
            });
            const moveProdMap = new Map(moveProducts.map(p => [p.id, p]));

            const nursingItems = stockMoves
                .filter(m => !billedSourceIds.has(m.id))
                .map(m => {
                    const product = moveProdMap.get(m.product_id);
                    const batchInfo = m.hms_product_batch ? ` (Batch: ${m.hms_product_batch.batch_no})` : '';
                    return {
                        id: m.product_id,
                        name: `${product?.name || 'Medical Consumable'}${batchInfo}`,
                        quantity: Number(m.qty || 1),
                        price: Number(m.cost || product?.price || 0),
                        source: 'nursing',
                        sourceId: m.id,
                        batch_id: m.batch_id,
                        batch_no: m.hms_product_batch?.batch_no,
                        expiry_date: m.hms_product_batch?.expiry_date,
                        type: 'item'
                    };
                });

            if (nursingItems.length > 0) {
                hubs.push({ id: 'nurse', label: 'Nursing Hub', items: nursingItems });
            }
        }

        // --- HUB 2: DOCTOR'S HUB (Prescriptions) ---
        const prescriptions = await prisma.prescription.findMany({
            where: {
                tenant_id: tenantId,
                patient_id: resolvedPatientId,
                created_at: { gte: sweepWindow }
            },
            include: {
                prescription_items: {
                    include: { 
                        hms_product: true,
                        // Include batch details if the doctor selected them in the Prescription Editor
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const drItems: any[] = [];
        prescriptions.forEach(p => {
            p.prescription_items.forEach(item => {
                if (!billedSourceIds.has(String(item.id))) {
                    const batchInfo = item.batch_no ? ` (Batch: ${item.batch_no})` : '';
                    drItems.push({
                        id: item.medicine_id,
                        name: `${item.hms_product?.name || 'Prescribed Item'}${batchInfo}`,
                        quantity: Number(item.days || 1), // Using 'days' as a proxy for quantity if not specified
                        price: Number(item.hms_product?.price || 0),
                        source: 'doctor',
                        sourceId: item.id,
                        batch_id: item.batch_id,
                        batch_no: item.batch_no,
                        type: item.hms_product?.is_service ? 'service' : 'medicine'
                    });
                }
            });
        });

        if (drItems.length > 0) {
            hubs.push({ id: 'doc', label: 'Doctor Hub', items: drItems });
        }

        // --- HUB 3: LAB HUB ---
        const labOrders = await prisma.hms_lab_order.findMany({
            where: {
                tenant_id: tenantId,
                patient_id: resolvedPatientId,
                created_at: { gte: sweepWindow }
            },
            include: {
                hms_lab_order_line: {
                    include: { hms_lab_test: true }
                }
            }
        });

        const labItems: any[] = [];
        labOrders.forEach(order => {
            order.hms_lab_order_line.forEach(line => {
                if (!billedSourceIds.has(String(line.id))) {
                    labItems.push({
                        id: line.test_id,
                        name: line.hms_lab_test?.name || 'Lab Investigation',
                        quantity: 1,
                        price: Number(line.hms_lab_test?.price || 0),
                        source: 'lab',
                        sourceId: line.id,
                        type: 'service',
                        status: order.status
                    });
                }
            });
        });

        if (labItems.length > 0) {
            hubs.push({ id: 'lab', label: 'Lab Hub', items: labItems });
        }

        // --- 4. PREPARE RESPONSE ---
        const draftInvoice = await prisma.hms_invoice.findFirst({
            where: { patient_id: resolvedPatientId, tenant_id: tenantId, status: 'draft' },
            include: { hms_invoice_lines: true },
            orderBy: { created_at: 'desc' }
        });

        const data = {
            hubs,
            initialInvoice: draftInvoice ? draftInvoice : null,
            initialItems: draftInvoice ? draftInvoice.hms_invoice_lines.map(l => ({
                id: l.product_id,
                name: l.description,
                quantity: Number(l.quantity),
                price: Number(l.unit_price),
                sourceId: (l.metadata as any)?.sourceId,
                batchId: (l.metadata as any)?.batchId // PRESERVE BATCH ID FROM DRAFT
            })) : []
        };

        return { success: true, data: serialize(data) };

    } catch (error: any) {
        console.error("[CLINICAL-SYNC] Fatal Discovery Error:", error);
        return { error: `Sync failed: ${error.message}` };
    }
}

export async function getPatientActiveAppointmentForBilling(patientId: string) {
    if (!isUUID(patientId)) return { success: false };
    const latest = await prisma.hms_appointments.findFirst({
        where: { patient_id: patientId },
        orderBy: { starts_at: 'desc' },
        select: { id: true }
    });
    return { success: !!latest, appointmentId: latest?.id };
}

export async function getOpenRegistrationInvoice(patientId: string) {
    if (!isUUID(patientId)) return { success: false };
    const invoice = await prisma.hms_invoice.findFirst({
        where: {
            patient_id: patientId,
            status: 'draft',
            hms_invoice_lines: {
                some: {
                    OR: [
                        { description: { contains: 'Reg', mode: 'insensitive' } },
                        { description: { contains: 'Registration', mode: 'insensitive' } }
                    ]
                }
            }
        },
        include: { hms_invoice_lines: true },
        orderBy: { created_at: 'desc' }
    });
    return { success: !!invoice, data: serialize(invoice) };
}

export async function getPatientTimeline(patientId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId || !isUUID(patientId)) return { success: false, error: "Unauthorized" };

    try {
        const [patient, appointments, admissions, labOrders, prescriptions, stockMoves, invoices] = await Promise.all([
            prisma.hms_patient.findUnique({ where: { id: patientId } }),
            prisma.hms_appointments.findMany({ 
                where: { patient_id: patientId, tenant_id: tenantId },
                orderBy: { starts_at: 'desc' }
            }),
            prisma.hms_admission.findMany({
                where: { patient_id: patientId, tenant_id: tenantId },
                orderBy: { admission_date: 'desc' }
            }),
            prisma.hms_lab_order.findMany({
                where: { patient_id: patientId, tenant_id: tenantId },
                include: { hms_lab_order_line: { include: { hms_lab_test: true } } },
                orderBy: { created_at: 'desc' }
            }),
            prisma.prescription.findMany({
                where: { patient_id: patientId, tenant_id: tenantId },
                include: { prescription_items: { include: { hms_product: true } } },
                orderBy: { created_at: 'desc' }
            }),
            prisma.hms_stock_move.findMany({
                where: { 
                    tenant_id: tenantId, 
                    source: { in: ['Nursing Consumption', 'Nursing Consumption (Pending)'] as any[] },
                    // In clinical context, source_reference is often the encounter/appointment ID
                    // But we can also find moves for this patient by looking at the reference metadata if needed
                    // For now, let's fetch based on the appointments we found
                },
                include: { hms_product: true }
            }),
            prisma.hms_invoice.findMany({
                where: { patient_id: patientId, tenant_id: tenantId },
                orderBy: { created_at: 'desc' }
            })
        ]);

        const events: TimelineEvent[] = [];

        // 1. Patient Registration
        if (patient) {
            events.push({
                id: `reg-${patient.id}`,
                type: 'REGISTRATION',
                title: 'Patient Registered',
                description: `Patient ${patient.first_name} ${patient.last_name} onboarded to the system.`,
                date: patient.created_at || new Date(),
                metadata: {}
            });
        }

        // 2. Appointments
        appointments.forEach(apt => {
            events.push({
                id: apt.id,
                type: 'APPOINTMENT',
                title: 'Clinical Encounter',
                description: `Visited for ${apt.purpose || 'Check-up'} with ${apt.doctor_name || 'Medical Officer'}.`,
                date: apt.starts_at,
                metadata: { status: apt.status }
            });
        });

        // 3. Admissions
        admissions.forEach(adm => {
            events.push({
                id: adm.id,
                type: 'ADMISSION',
                title: 'Hospital Admission',
                description: `Admitted to ${adm.ward_id ? 'Ward' : 'Emergency'}. Status: ${adm.status}`,
                date: adm.admission_date,
                metadata: { bed: adm.bed_id, status: adm.status }
            });
            if (adm.discharge_date) {
                events.push({
                    id: `dis-${adm.id}`,
                    type: 'DISCHARGE',
                    title: 'Patient Discharged',
                    description: `Clinical care completed. Summary: ${adm.discharge_summary || 'Normal recovery'}`,
                    date: adm.discharge_date,
                    metadata: { reason: adm.discharge_reason }
                });
            }
        });

        // 4. Lab Orders
        labOrders.forEach(order => {
            events.push({
                id: order.id,
                type: 'LAB_ORDER',
                title: 'Lab Investigation',
                description: `${order.hms_lab_order_line.length} tests requested. Status: ${order.status}`,
                date: order.created_at,
                metadata: { tests: order.hms_lab_order_line.map(l => l.hms_lab_test?.name) }
            });
        });

        // 5. Prescriptions
        prescriptions.forEach(p => {
            events.push({
                id: p.id,
                type: 'PRESCRIPTION',
                title: 'Medical Prescription',
                description: `${p.prescription_items.length} medicines advised by ${p.doctor_name || 'the physician'}.`,
                date: p.created_at,
                metadata: { plan: p.clinical_notes }
            });
        });

        // 6. Billing
        invoices.forEach(inv => {
            events.push({
                id: inv.id,
                type: 'BILLING',
                title: 'Hospital Invoice',
                description: `Invoice ${inv.invoice_number} generated.`,
                date: inv.created_at || new Date(),
                metadata: { total: Number(inv.total_amount), status: inv.status }
            });
        });

        // 7. Consumables (Filter by encounter IDs)
        const aptIds = new Set(appointments.map(a => a.id));
        stockMoves.forEach(move => {
            if (aptIds.has(move.source_reference || '')) {
                events.push({
                    id: move.id,
                    type: 'CONSUMABLES',
                    title: 'Clinical Consumable',
                    description: `${move.qty} ${move.uom_id || 'units'} of ${move.hms_product?.name || 'Item'} used.`,
                    date: move.created_at,
                    metadata: { product_name: move.hms_product?.name, notes: move.reference }
                });
            }
        });

        // Sort all events by date descending
        events.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { 
            success: true, 
            data: serialize(events),
            patient: serialize(patient)
        };

    } catch (e: any) {
        console.error("[TIMELINE] Error:", e);
        return { success: false, error: e.message };
    }
}
