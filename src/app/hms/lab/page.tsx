import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { LabDashboardClient } from "@/components/hms/lab/lab-dashboard-client"
import { ensureHmsMenus } from "@/lib/menu-seeder"
import { FlaskConical } from "lucide-react"
import { getBillableItems, getTaxConfiguration } from "@/app/actions/billing"

export const dynamic = 'force-dynamic'

export default async function LabDashboardPage() {
    await ensureHmsMenus()
    const session = await auth()

    if (!session?.user?.email) {
        redirect("/auth/signin")
    }

    const tenantId = session.user.tenantId
    // For now assuming any user with access to this route is authorized (RBAC handles route protection usually)
    // We can just use the user's name as "Lab Staff"

    // Fetch Lab Orders
    // We want today's orders OR pending orders regardless of date?
    // Usually a dashboard shows active work. So all 'requested', 'pending', 'in_progress'.
    // And 'completed' from today.

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [orders, patientsRes, itemsRes, taxRes] = await Promise.all([
        prisma.hms_lab_order.findMany({
            where: {
                tenant_id: tenantId,
                OR: [
                    { status: { in: ['requested', 'pending', 'in_progress', 'collected'] } },
                    {
                        status: 'completed',
                        created_at: { gte: todayStart }
                    }
                ]
            },
            include: {
                hms_patient: true,
                hms_appointment: {
                    include: {
                        hms_clinician: true,
                        hms_invoice: {
                            select: {
                                id: true,
                                status: true
                            }
                        }
                    }
                },
                hms_lab_order_line: {
                    include: {
                        hms_lab_test: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        }),
        prisma.hms_patient.findMany({
            where: { tenant_id: tenantId },
            select: {
                id: true, first_name: true, last_name: true, contact: true,
                patient_number: true, dob: true, gender: true, metadata: true
            },
            orderBy: { updated_at: 'desc' },
            take: 50
        }),
        getBillableItems(),
        getTaxConfiguration()
    ])

    const patients = patientsRes;
    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };

    // Transform Data
    const formattedOrders = orders.map(order => {
        const tests = order.hms_lab_order_line.map(line => ({
            id: line.id,
            test_name: line.hms_lab_test?.name || 'Unknown Test',
            status: line.status,
            price: Number(line.price) || 0
        }))

        // Calculate Total Price
        const totalPrice = tests.reduce((sum, test) => sum + test.price, 0)

        // Patient Name
        const patientName = order.hms_patient
            ? `${order.hms_patient.first_name} ${order.hms_patient.last_name || ''}`.trim()
            : 'Unknown Patient'

        // Doctor Name
        const doctorName = order.hms_appointment?.hms_clinician
            ? `${order.hms_appointment.hms_clinician.first_name} ${order.hms_appointment.hms_clinician.last_name}`.trim()
            : 'Unknown'

        // Get invoice info from appointment
        const invoice = order.hms_appointment?.hms_invoice?.[0];

        return {
            id: order.id,
            order_number: order.order_number,
            time: order.created_at || new Date(),
            status: order.status,
            priority: order.priority,
            patient_name: patientName,
            patient_id: order.hms_patient?.patient_number,
            doctor_name: doctorName,
            tests: tests,
            report_url: order.report_url,
            totalPrice: totalPrice,
            invoice_id: invoice?.id,
            invoice_status: invoice?.status
        }
    })

    // Calculate Stats
    const stats = {
        total: formattedOrders.length,
        pending: formattedOrders.filter(o => ['requested', 'pending', 'in_progress', 'collected'].includes(o.status || '')).length,
        completed: formattedOrders.filter(o => o.status === 'completed').length
    }

    return (
        <LabDashboardClient
            labStaffName={session.user.name || 'Lab Staff'}
            orders={formattedOrders}
            stats={stats}
            patients={patients}
            billableItems={billableItems as any[]}
            taxConfig={taxConfig}
        />
    )
}
