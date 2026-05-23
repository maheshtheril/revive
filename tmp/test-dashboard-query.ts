import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    try {
        const tenantId = 'test';
        const companyId = 'test';
        const todayStart = new Date();
        const todayEnd = new Date();
        
        await Promise.all([
            prisma.hms_appointments.findMany({
                where: {
                    tenant_id: tenantId,
                    starts_at: { gte: todayStart, lte: todayEnd }
                },
                select: {
                    id: true,
                    patient_id: true,
                    branch_id: true,
                    clinician_id: true,
                    starts_at: true,
                    ends_at: true,
                    status: true,
                    type: true,
                    priority: true,
                    notes: true,
                    hms_patient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            patient_number: true,
                            dob: true,
                            gender: true,
                            contact: true
                        }
                    },
                    hms_clinician: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            hms_specializations: { select: { name: true } }
                        }
                    },
                    prescription: { select: { id: true } },
                    hms_invoice: { select: { id: true, status: true, total: true, outstanding_amount: true } },
                    hms_lab_order: { select: { id: true, status: true } }
                },
                orderBy: { starts_at: 'desc' },
                take: 1
            }),
            prisma.payments.findMany({
                where: {
                    tenant_id: tenantId,
                    metadata: { path: ['type'], equals: 'outbound' },
                    created_at: { gte: todayStart, lte: todayEnd }
                },
                take: 1
            })
        ]);
        console.log("SUCCESS");
    } catch (e: any) {
        console.log("ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
