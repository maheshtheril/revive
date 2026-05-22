import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const patientNo = searchParams.get('no') || 'PAT-655339';
        
        console.log(`[DIAGNOSTIC] Probing for Patient Number: ${patientNo}`);

        // 1. Find Patient
        const patient = await prisma.hms_patient.findFirst({
            where: { patient_number: patientNo }
        });

        if (!patient) {
            return NextResponse.json({ error: "Patient not found by number" });
        }

        const pid = patient.id;
        console.log(`[DIAGNOSTIC] Found Patient ID: ${pid}`);

        // 2. Check Nursing Moves
        const moves = await prisma.$queryRaw`
            SELECT id, patient_id::text, source, source_reference::text, product_id::text, qty, created_at 
            FROM hms_stock_move 
            WHERE patient_id::text = CAST(${pid} AS text)
            OR source_reference IN (
                SELECT id::text FROM hms_appointments WHERE patient_id::text = CAST(${pid} AS text)
            )
            LIMIT 50
        `;

        // 3. Check Prescriptions
        const rxs = await prisma.$queryRaw`
            SELECT id, patient_id::text, appointment_id::text, created_at 
            FROM prescription 
            WHERE patient_id::text = CAST(${pid} AS text)
            OR appointment_id IN (
                SELECT id::text FROM hms_appointments WHERE patient_id::text = CAST(${pid} AS text)
            )
            LIMIT 10
        `;

        // 4. Check Lab Orders
        const labs = await prisma.$queryRaw`
            SELECT id, patient_id::text, encounter_id::text, status, created_at 
            FROM hms_lab_order 
            WHERE patient_id::text = CAST(${pid} AS text)
            OR encounter_id IN (
                SELECT id::text FROM hms_appointments WHERE patient_id::text = CAST(${pid} AS text)
            )
            LIMIT 10
        `;

        return NextResponse.json({
            success: true,
            patient: { id: patient.id, name: patient.name, number: patient.patient_number },
            movesCount: (moves as any[]).length,
            rxsCount: (rxs as any[]).length,
            labsCount: (labs as any[]).length,
            sampleMoves: (moves as any[]).slice(0, 3),
            sampleRxs: (rxs as any[]).slice(0, 3)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message });
    }
}
