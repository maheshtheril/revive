'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function searchPatients(query: string) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        
        console.log(`[PATIENT-SEARCH] Q: "${query}" | Tenant: ${tenantId} | User: ${session?.user?.id}`);

        if (!tenantId) {
            console.error("[PATIENT-SEARCH] NO TENANT ID IN SESSION");
            return [];
        }
        if (!query) return [];

        // Special handling for short queries: search names and IDs only
        const isShort = query.length < 2;
        const isAdmin = session.user.isAdmin || (session.user as any).isTenantAdmin;

        const patients = await prisma.hms_patient.findMany({
            where: {
                tenant_id: tenantId,
                ...(!isAdmin && { created_by: session.user.id }),
                OR: [
                    { first_name: { contains: query, mode: 'insensitive' } },
                    { last_name: { contains: query, mode: 'insensitive' } },
                    { full_name: { contains: query, mode: 'insensitive' } },
                    { patient_number: { contains: query, mode: 'insensitive' } },
                    {
                        contact: {
                            path: ['phone'],
                            string_contains: query
                        }
                    },
                    {
                        contact: {
                            path: ['mobile'],
                            string_contains: query
                        }
                    },
                    {
                        contact: {
                            path: ['email'],
                            string_contains: query
                        }
                    }
                ]
            },
            take: 25,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                patient_number: true,
                contact: true,
                gender: true
            }
        });

        console.log(`[SEARCH] Found ${patients.length} patients.`);

        return patients.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            patient_number: p.patient_number,
            gender: p.gender,
            contact: p.contact,
            phone: (p.contact as any)?.phone || (p.contact as any)?.mobile || ''
        }));
    } catch (error) {
        console.error("SEARCH_FATAL_ERROR:", error);
        // Fallback to name-only search
        const session = await auth();
        if (!session?.user?.tenantId) return [];
        
        const fallback = await prisma.hms_patient.findMany({
            where: {
                tenant_id: session.user.tenantId,
                ...(!isAdmin && { created_by: session.user.id }),
                OR: [
                    { first_name: { contains: query, mode: 'insensitive' } },
                    { last_name: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10
        });
        return fallback.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            patient_number: p.patient_number,
            gender: p.gender,
            contact: p.contact,
            phone: ''
        }));
    }
}
