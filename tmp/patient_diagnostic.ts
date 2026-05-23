
import { prisma } from "../src/lib/prisma";

async function diagnose() {
    const patientNo = 'PAT-655339';
    console.log(`[DIAGNOSTIC] Investigating Patient: ${patientNo}`);

    const patient = await prisma.hms_patient.findFirst({
        where: { patient_number: patientNo }
    });

    if (!patient) {
        console.log("!!! Patient Not Found");
        return;
    }

    const patientId = patient.id;
    console.log(`[DIAGNOSTIC] Internal ID: ${patientId}`);

    // 1. Check Appointments
    const appointments = await prisma.hms_appointments.findMany({
        where: { patient_id: patientId },
        orderBy: { starts_at: 'desc' }
    });
    console.log(`[DIAGNOSTIC] Found ${appointments.length} appointments.`);
    const apptIds = appointments.map(a => a.id);

    // 2. Check Nursing Consumption
    const nursingItems = await prisma.hms_stock_move.findMany({
        where: {
            OR: [
                { source_reference: { in: apptIds as any[] } },
                { source: { contains: 'Nursing', mode: 'insensitive' } }
            ]
        }
    });
    console.log(`[DIAGNOSTIC] Found ${nursingItems.length} Nursing Items.`);
    nursingItems.forEach(m => {
        console.log(`   - MoveID: ${m.id} | Source: ${m.source} | Ref: ${m.source_reference} | Product: ${m.product_id}`);
    });

    // 3. Check Prescriptions
    const prescriptions = await prisma.prescription.findMany({
        where: { patient_id: patientId },
        include: { hms_prescription_items: true }
    });
    console.log(`[DIAGNOSTIC] Found ${prescriptions.length} Prescriptions.`);
    prescriptions.forEach(p => {
        console.log(`   - PrescriptionID: ${p.id} | Items: ${p.hms_prescription_items.length}`);
    });

    // 4. Check Lab Orders
    const labs = await prisma.hms_lab_order.findMany({
        where: { patient_id: patientId },
        include: { hms_lab_order_line: true }
    });
    console.log(`[DIAGNOSTIC] Found ${labs.length} Lab Orders.`);

    // 5. Check Invoices (Double-billing guard check)
    const invoices = await prisma.hms_invoice_lines.findMany({
        where: {
            hms_invoice: { patient_id: patientId }
        }
    });
    console.log(`[DIAGNOSTIC] Found ${invoices.length} already billed lines.`);
    invoices.forEach(l => {
        console.log(`   - InvoiceLineID: ${l.id} | Metadata: ${JSON.stringify(l.metadata)}`);
    });
}

diagnose().catch(console.error);
