import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { AppointmentForm } from "@/components/appointments/appointment-form"

export default async function NewAppointmentPage({
    searchParams
}: {
    searchParams: Promise<{
        patient_id?: string
        date?: string
        time?: string
    }>
}) {
    const resolvedParams = await searchParams;
    const { patient_id, date, time } = resolvedParams;

    const session = await auth()
    const tenantId = session?.user?.tenantId

    // Fetch data with better selection
    const [patients, doctors] = await Promise.all([
        prisma.hms_patient.findMany({
            where: tenantId ? { tenant_id: tenantId } : undefined,
            take: 100,
            orderBy: { updated_at: 'desc' },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                patient_number: true,
                dob: true,
                contact: true,
                gender: true
            }
        }),
        prisma.hms_clinicians.findMany({
            where: { is_active: true },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                hms_specializations: { select: { name: true } },
                role: true
            },
            orderBy: { first_name: 'asc' }
        })
    ])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 h-screen">
            <AppointmentForm
                patients={patients}
                doctors={doctors}
                initialData={{ patient_id, date, time }}
            />
        </div>
    )
}
