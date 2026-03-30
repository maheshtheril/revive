'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function getPatientHistory(patientId: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { success: false, error: "Unauthorized" }

    try {
        const history = await prisma.hms_patient_history.findMany({
            where: { 
                patient_id: patientId,
                tenant_id: session.user.tenantId
            },
            orderBy: { changed_at: 'desc' },
            take: 50
        })

        // Serialize BigInt and other Prisma objects
        return { 
            success: true, 
            data: JSON.parse(JSON.stringify(history, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            ))
        }
    } catch (err: any) {
        console.error("Audit History Error:", err)
        return { success: false, error: err.message }
    }
}
