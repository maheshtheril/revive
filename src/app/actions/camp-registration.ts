'use server'

import { prisma } from "@/lib/prisma"
import crypto from "crypto"

interface CampPatientInput {
    firstName: string;
    lastName: string;
    dob?: string;
    gender?: string;
    phone: string;
    email?: string;
    bloodGroup?: string;
}

export async function registerCampPatient(input: CampPatientInput) {
    const { headers } = await import("next/headers");
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const cleanHost = host.toLowerCase().replace(/^www\./, '').split(':')[0];

    try {
        let tenant = null;

        // Try lookup by custom domain or subdomain
        if (cleanHost) {
            const hostParts = cleanHost.split('.');
            const firstPart = hostParts[0];

            tenant = await prisma.tenant.findFirst({
                where: {
                    OR: [
                        { domain: cleanHost },
                        { domain: host },
                        { slug: firstPart }
                    ]
                },
                select: { id: true, company_settings: { select: { company_id: true } } }
            });
        }

        // Fallback: newest tenant if none resolves
        if (!tenant) {
            tenant = await prisma.tenant.findFirst({
                orderBy: { created_at: 'desc' },
                select: { id: true, company_settings: { select: { company_id: true } } }
            });
        }

        if (!tenant) {
            return { error: "No active tenant configuration found on the system." };
        }

        const tenantId = tenant.id;
        const companyId = tenant.company_settings?.[0]?.company_id || tenantId;

        // Basic validation
        if (!input.firstName?.trim() || !input.phone?.trim()) {
            return { error: "First Name and Phone Number are required." };
        }

        const contactInfo = {
            phone: input.phone.trim(),
            email: input.email?.trim() || null,
            address: { street: "Camp Site", city: "Camp", zip: "000000" }
        };

        // Create the patient in staging state
        const patient = await prisma.hms_patient.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                company_id: companyId,
                first_name: input.firstName.trim(),
                last_name: input.lastName?.trim() || "",
                dob: input.dob ? new Date(input.dob) : null,
                gender: input.gender || null,
                contact: contactInfo as any,
                blood_group: input.bloodGroup || null,
                status: "pending_sync",
                source_system: "camp_cloud",
                patient_number: null,
                metadata: {
                    created_via: "Camp-Cloud-Registration",
                    registration_notes: "Registered during Camp (Awaiting Edge Sync)"
                } as any
            }
        });

        return { success: true, patientId: patient.id };
    } catch (err: any) {
        console.error("Camp patient registration exception:", err);
        return { error: `Registration error: ${err.message}` };
    }
}
