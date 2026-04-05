import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { UsageForm } from "@/components/hms/nursing/usage-form"

export default async function NursingUsagePage({
    searchParams,
}: {
    searchParams: { patientId?: string; encounterId?: string }
}) {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/auth/signin")
    }

    const { patientId, encounterId } = searchParams

    if (!patientId || !encounterId) {
        return (
            <div className="p-8 text-center text-red-500">
                <h2 className="text-xl font-bold">Missing Parameters</h2>
                <p>Patient ID and Encounter ID are required to record usage.</p>
            </div>
        )
    }

    // Fetch Patient Details for Context
    const patient = await prisma.hms_patient.findUnique({
        where: { id: patientId },
        select: { first_name: true, last_name: true, patient_number: true }
    })

    if (!patient) {
        return (
            <div className="p-8 text-center text-red-500">
                <h2 className="text-xl font-bold">Patient Not Found</h2>
            </div>
        )
    }

    const patientName = `${patient.first_name} ${patient.last_name || ''}`.trim()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center">
            <UsageForm
                patientId={patientId}
                encounterId={encounterId}
                patientName={patientName}
            />
        </div>
    )
}
