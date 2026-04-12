'use server'

import { prisma } from "@/lib/prisma"

// Nurse station actions placeholder - To be implemented
export async function getPatientVitalsSummary(patientId: string) {
    if (!patientId) return null;
    return await prisma.hms_vitals.findFirst({
        where: { id: patientId },
        orderBy: { recorded_at: 'desc' }
    });
}
