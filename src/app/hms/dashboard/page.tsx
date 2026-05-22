import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DashboardClient } from "@/components/hms/dashboard-client"
import { ensureHmsMenus } from "@/lib/menu-seeder"
import { getTenant } from "../../actions/tenant"
import { getCurrentCompany } from "../../actions/company"
import { redirect } from 'next/navigation'
// hms_invoice_status removed
import { getUserPermissions } from "@/app/actions/rbac"


export default async function DashboardPage() {
    // [OPTIMIZATION] Removed blocking ensureHmsMenus() - Self-healing handled in background or on-demand
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    const perms = await getUserPermissions(session.user.id);

    // 1. DOCTOR DASHBOARD (High Priority)
    if (perms.includes('hms:dashboard:doctor')) {
        redirect('/hms/doctor/dashboard');
    }

    // 2. NURSING DASHBOARD
    if (perms.includes('hms:dashboard:nurse')) {
        redirect('/hms/nursing/dashboard');
    }

    // 3. RECEPTION DASHBOARD
    if (perms.includes('hms:dashboard:reception')) {
        redirect('/hms/reception/dashboard');
    }

    // 4. LAB DASHBOARD
    if (perms.includes('hms:dashboard:lab')) {
        redirect('/hms/lab/dashboard');
    }

    // 5. ACCOUNTING DASHBOARD
    if (perms.includes('hms:dashboard:accounting')) {
        redirect('/hms/accounting');
    }

    // --- LEGACY FAIL-SAFE: Redirect based on role name/string (Compatibility Mode) ---
    const role = session?.user?.role?.toLowerCase() || '';
    const name = session?.user?.name?.toLowerCase() || '';
    const email = session?.user?.email?.toLowerCase() || '';

    if (role === 'receptionist' || name.includes('reception')) {
        redirect('/hms/reception/dashboard');
    }

    if (role.includes('lab') || name.includes('lab') || email.includes('laab')) {
        redirect('/hms/lab/dashboard');
    }

    if (role === 'accountant' || role === 'finance' || name.includes('account')) {
        redirect('/hms/accounting');
    }


    const tenantId = session?.user?.tenantId
    const companyId = session?.user?.companyId

    if (!tenantId || !companyId) {
        // Fallback for Receptionists who might be routed here but belong at /hms/reception/dashboard
        if (session?.user?.role === 'receptionist') {
            redirect('/hms/reception/dashboard');
        }

        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                <div className="text-lg font-semibold mb-2">Setup Required</div>
                <p>You are logged in, but no default Company is assigned to your account.</p>
                <p className="text-sm mt-4">Tenant ID: {tenantId || 'Missing'}</p>
            </div>
        )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Fetch essential data in parallel
    const [
        patients,
        doctors,
        rawAppointments,
        totalPatientsCount,
        pendingBillsCount,
        revenueAggregate,
        tenant,
        currentCompany
    ] = await Promise.all([
        // 1. Patients for modal (limit to recent/active)
        prisma.hms_patient.findMany({
            where: { tenant_id: tenantId },
            take: 100,
            orderBy: { updated_at: 'desc' },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                patient_number: true,
                dob: true,
                gender: true
            }
        }),

        // 2. Doctors for modal
        prisma.hms_clinicians.findMany({
            where: {
                is_active: true,
                tenant_id: tenantId
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                hms_specializations: { select: { name: true } },
                role: true,
                consultation_start_time: true,
                consultation_end_time: true,
                consultation_slot_duration: true
            },
            orderBy: { first_name: 'asc' }
        }),

        // 3. Appointments for today
        prisma.hms_appointments.findMany({
            where: {
                tenant_id: tenantId,
                company_id: companyId,
                starts_at: {
                    gte: today,
                    lt: tomorrow
                }
            },
            orderBy: { starts_at: 'asc' }
        }),

        // 4. Stats: Total Patients
        prisma.hms_patient.count({ where: { tenant_id: tenantId } }),

        // 5. Stats: Pending Bills
        prisma.hms_invoice.count({
            where: {
                tenant_id: tenantId,
                status: 'draft' as any
            }
        }),

        // 6. Stats: Revenue (Today)
        prisma.hms_invoice.aggregate({
            where: {
                tenant_id: tenantId,
                status: 'paid' as any,
                created_at: {
                    gte: today,
                    lt: tomorrow
                }
            },
            _sum: {
                total: true
            }
        }).then(r => Number(r._sum.total || 0)),

        // 7. Tenant Branding
        getTenant(),

        // 8. Company Branding
        getCurrentCompany()
    ])

    // Manual enrichment of appointments
    const patientIds = [...new Set(rawAppointments.map(a => a.patient_id).filter(Boolean))] as string[]
    const clinicianIds = [...new Set(rawAppointments.map(a => a.clinician_id).filter(Boolean))] as string[]

    const [relatedPatients, relatedClinicians] = await Promise.all([
        prisma.hms_patient.findMany({
            where: { id: { in: patientIds } },
            select: { id: true, first_name: true, last_name: true, patient_number: true }
        }),
        prisma.hms_clinicians.findMany({
            where: { id: { in: clinicianIds } },
            select: { id: true, first_name: true, last_name: true }
        })
    ])

    const patientMap = new Map(relatedPatients.map(p => [p.id, p]))
    const clinicianMap = new Map(relatedClinicians.map(c => [c.id, c]))

    const appointments = rawAppointments.map(apt => ({
        ...apt,
        patient: patientMap.get(apt.patient_id as string) || { first_name: 'Unknown', last_name: '', patient_number: 'N/A' },
        clinician: clinicianMap.get(apt.clinician_id as string) || { first_name: 'Unknown', last_name: '' }
    }))

    const stats = {
        totalPatients: totalPatientsCount,
        todayAppointments: appointments.length,
        pendingBills: pendingBillsCount as number,
        revenue: Number(revenueAggregate || 0)
    }

    return (
        <DashboardClient
            user={JSON.parse(JSON.stringify(session.user))}
            stats={stats}
            appointments={JSON.parse(JSON.stringify(appointments))}
            patients={JSON.parse(JSON.stringify(patients))}
            doctors={JSON.parse(JSON.stringify(doctors))}
            tenant={tenant}
            company={currentCompany}
        />
    )
}
