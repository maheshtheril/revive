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
        console.log(`[GET /api/prescriptions/by-appointment/${id}] Fetching for tenant: ${session.user.tenantId}`)

        // Use Raw SQL for consistency and better error detection
        const prescriptions: any[] = await prisma.$queryRaw`
            SELECT p.*, 
                JSON_AGG(JSON_BUILD_OBJECT(
                    'id', pi.id,
                    'medicine_id', pi.medicine_id,
                    'morning', pi.morning,
                    'afternoon', pi.afternoon,
                    'evening', pi.evening,
                    'night', pi.night,
                    'days', pi.days,
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
            WHERE p.appointment_id::text = CAST(${id} AS text)
            AND p.tenant_id::text = CAST(${session.user.tenantId} AS text)
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT 1
        `;

        const vitalsArr: any[] = await prisma.$queryRaw`
            SELECT v.* FROM hms_vitals v
            WHERE v.encounter_id::text = CAST(${id} AS text)
            LIMIT 1
        `;

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
            WHERE lo.encounter_id::text = CAST(${id} AS text)
            AND lo.tenant_id::text = CAST(${session.user.tenantId} AS text)
            AND lo.status = 'requested'
            GROUP BY lo.id
            ORDER BY lo.created_at DESC
            LIMIT 1
        `;

        const prescription = prescriptions[0];
        const vitals = vitalsArr[0];
        const labOrder = labOrders[0];

        // Fetch nursing consumption items independently
        const consumptionItems: any[] = await prisma.$queryRaw`
            SELECT 
                sm.id, sm.qty, sm.uom, sm.created_at,
                p.name as product_name,
                u.full_name as nurse_name
            FROM hms_stock_move sm
            LEFT JOIN hms_product p ON sm.product_id = p.id
            LEFT JOIN app_user u ON sm.created_by = u.id
            WHERE sm.source_reference::text = CAST(${id} AS text)
            AND sm.source = 'Nursing Consumption'
            AND sm.tenant_id::text = CAST(${session.user.tenantId} AS text)
            ORDER BY sm.created_at DESC
        `;

        console.log(`[GET /api/prescriptions/by-appointment/${id}] Found:`, {
            prescriptionId: prescription?.id,
            vitalsId: vitals?.id,
            labOrderId: labOrder?.id,
            itemCount: prescription?.prescription_items?.length,
            labCount: labOrder?.tests?.length,
            consumptionCount: consumptionItems.length
        })

        if (!prescription && !vitals && consumptionItems.length === 0) {
            return NextResponse.json({ success: true, prescription: null, vitals: null, consumption: [] })
        }

        // Format for frontend (handle the aggregate JSON structure safely)
        let medicines = [];
        if (prescription && Array.isArray(prescription.prescription_items)) {
            medicines = prescription.prescription_items
                .filter((item: any) => item && item.medicine_id && item.hms_product && item.hms_product.id)
                .map((item: any) => ({
                    id: item.hms_product.id,
                    name: item.hms_product.name,
                    dosage: `${item.morning || 0}-${item.afternoon || 0}-${item.evening || 0}-${item.night || 0}`,
                    days: (item.days || 3).toString(),
                    timing: 'After Food',
                    quantity: ((item.morning || 0) + (item.afternoon || 0) + (item.evening || 0) + (item.night || 0)) * (item.days || 0)
                }));
        }

        return NextResponse.json({
            success: true,
            prescription: prescription ? {
                ...prescription,
                medicines,
                labTests: labOrder?.tests || []
            } : null,
            vitals: vitals || null,
            consumption: consumptionItems
        })
    } catch (error) {
        console.error('Error fetching prescription by appointment:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
