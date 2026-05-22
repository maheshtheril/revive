import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        console.log(`[GET /api/prescriptions/${id}] Fetching for tenant: ${session.user.tenantId}`)

        // Use Raw SQL for consistency
        const rawPrescriptions: any[] = await prisma.$queryRaw`
            SELECT p.*, 
                JSON_AGG(JSON_BUILD_OBJECT(
                    'id', pi.id,
                    'medicine_id', pi.medicine_id,
                    'morning', pi.morning,
                    'afternoon', pi.afternoon,
                    'evening', pi.evening,
                    'night', pi.night,
                    'days', pi.days,
                    'batch_id', pi.batch_id,
                    'batch_no', pi.batch_no,
                    'hms_product', JSON_BUILD_OBJECT(
                        'id', prod.id,
                        'name', prod.name,
                        'sku', prod.sku,
                        'price', prod.price
                    )
                )) as prescription_items
            FROM prescription p
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            LEFT JOIN hms_product prod ON pi.medicine_id = prod.id
            WHERE p.id::text = CAST(${id} AS text)
            AND p.tenant_id::text = CAST(${session.user.tenantId} AS text)
            GROUP BY p.id
            LIMIT 1
        `;

        // Parse JSON_AGG if it's returned as a string
        const prescriptions = rawPrescriptions.map(p => ({
            ...p,
            prescription_items: typeof p.prescription_items === 'string' 
                ? JSON.parse(p.prescription_items) 
                : p.prescription_items
        }));

        const activePrescription = prescriptions[0];

        if (!activePrescription) {
            return NextResponse.json({ success: true, prescription: null, vitals: null })
        }

        let consumption: any[] = [];
        let vitals = null;
        let labTests = [];

        // Fetch vitals and consumption if linked to an appointment
        if (activePrescription.appointment_id) {
            const vitalsArr: any[] = await prisma.$queryRaw`
                SELECT v.* FROM hms_vitals v
                WHERE v.encounter_id::text = CAST(${activePrescription.appointment_id} AS text)
                LIMIT 1
            `;
            vitals = vitalsArr[0];

            // Fetch lab orders for this appointment
            const labOrders: any[] = await prisma.$queryRaw`
                SELECT lo.id, 
                    COALESCE(
                        JSON_AGG(JSON_BUILD_OBJECT(
                            'id', lt.id,
                            'name', lt.name,
                            'price', lol.price
                        )) FILTER (WHERE lt.id IS NOT NULL),
                        '[]'::json
                    ) as tests
                FROM hms_lab_order lo
                LEFT JOIN hms_lab_order_line lol ON lo.id = lol.order_id
                LEFT JOIN hms_lab_test lt ON lol.test_id = lt.id
                WHERE lo.encounter_id::text = CAST(${activePrescription.appointment_id} AS text)
                AND lo.tenant_id::text = CAST(${session.user.tenantId} AS text)
                AND lo.status = 'requested'
                GROUP BY lo.id
                ORDER BY lo.created_at DESC
                LIMIT 1
            `;
            labTests = labOrders[0]?.tests || [];
            if (typeof labTests === 'string') labTests = JSON.parse(labTests);

            // Fetch nursing consumption items independently
            const consumptionItems: any[] = await prisma.$queryRaw`
                SELECT 
                    sm.id, sm.qty, sm.uom, sm.created_at,
                    p.name as product_name,
                    u.full_name as nurse_name
                FROM hms_stock_move sm
                LEFT JOIN hms_product p ON sm.product_id = p.id
                LEFT JOIN app_user u ON sm.created_by = u.id
                WHERE sm.source_reference::text = CAST(${activePrescription.appointment_id} AS text)
                AND sm.source = 'Nursing Consumption'
                AND sm.tenant_id::text = CAST(${session.user.tenantId} AS text)
                ORDER BY sm.created_at DESC
            `;

            // Aggregate consumption items
            consumption = consumptionItems.reduce((acc: any[], curr: any) => {
                const existing = acc.find(a => a.product_name === curr.product_name && a.uom === curr.uom);
                if (existing) {
                    existing.qty = Number(existing.qty) + Number(curr.qty);
                } else {
                    acc.push({ ...curr });
                }
                return acc;
            }, []);
        }

        // Format for frontend
        let medicines = [];
        if (activePrescription.prescription_items && Array.isArray(activePrescription.prescription_items)) {
            medicines = activePrescription.prescription_items
                .filter((item: any) => item && item.medicine_id && item.hms_product && (item.hms_product.id || item.hms_product.name))
                .map((item: any) => ({
                    id: item.hms_product.id,
                    name: item.hms_product.name,
                    dosage: `${item.morning || 0}-${item.afternoon || 0}-${item.evening || 0}-${item.night || 0}`,
                    days: (item.days || 3).toString(),
                    timing: 'After Food',
                    batchId: item.batch_id,
                    batchNo: item.batch_no,
                    quantity: ((item.morning || 0) + (item.afternoon || 0) + (item.evening || 0) + (item.night || 0)) * (item.days || 0)
                }));
        }

        return NextResponse.json({
            success: true,
            prescription: {
                ...activePrescription,
                medicines,
                labTests
            },
            vitals: vitals || null,
            consumption
        })
    } catch (error) {
        console.error('Error fetching prescription:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
