'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getNextPatientNumber } from "./patient-v10"

const normalizeGender = (gender: string | null) => {
    if (!gender) return null;
    const g = gender.toLowerCase().trim();
    if (g === 'm' || g === 'male') return 'male';
    if (g === 'f' || g === 'female') return 'female';
    if (g === 'other') return 'other';
    if (g === 'unknown') return 'unknown';
    return null;
}

export async function createPatientEmergency(existingId: string | null | any, formData: FormData) {
    console.log("EMERGENCY PATIENT CREATION - SKIPPING INVOICE");
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    // TODO: Get Tenant ID from session
    const dob = formData.get('dob') as string
    const gender = formData.get('gender') as string
    const blood_group = formData.get('blood_group') as string

    // Parse Contact Details
    const address = {
        street: formData.get('street'),
        city: formData.get('city'),
        state: formData.get('state'),
        zip: formData.get('zip'),
        country: formData.get('country')
    }

    const emergency_contact = {
        name: formData.get('emergency_name'),
        relation: formData.get('emergency_relation'),
        phone: formData.get('emergency_phone')
    }

    const insurance = {
        provider: formData.get('insurance_provider'),
        policy_no: formData.get('insurance_policy_no'),
        valid_till: formData.get('insurance_valid_till')
    }

    // Construct JSON objects
    const contact = {
        address,
        emergency_contact,
        phone: formData.get('phone'),
        email: formData.get('email')
    }

    // Combine metadata
    let metadata: any = {
        title: formData.get("title") as string,
        id_card_url: formData.get("id_card_url") as string,
        insurance,
        registration_notes: "Created via Emergency Bypass (No Invoice Generated)"
    }

    const session = await auth()
    const tenantId = session?.user?.tenantId
    const companyId = session?.user?.companyId
    const userId = session?.user?.id

    if (!tenantId) return { error: "No tenant found." }
    if (!firstName) return { error: "Name is required" }

    try {
        let patient;
        // Create New Only (Simple)
        const registrationDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() - 1); // Set to past to force payment
        metadata.registration_date = registrationDate.toISOString();
        metadata.registration_expiry = expiryDate.toISOString();
        metadata.status = 'awaiting_payment';
        metadata.accounting_group = (formData.get('accounting_group') as string) || 'general';

        const nextPatientNumber = await getNextPatientNumber((companyId || tenantId) as string, tenantId as string);

        patient = await prisma.hms_patient.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                company_id: (companyId || tenantId) as string,
                first_name: firstName,
                last_name: lastName || '',
                dob: dob ? new Date(dob) : null,
                gender: normalizeGender(gender),
                contact: contact as any,
                // @ts-ignore
                blood_group: blood_group || null,
                profile_image_url: (formData.get("profile_image_url") as string) || null,
                metadata: metadata as any,
                patient_number: nextPatientNumber,
                created_by: userId,
                updated_by: userId
            }
        });

        // Skip Invoice Logic Entirely
        return {
            success: true,
            data: patient,
            invoiceId: null,
            warning: "Emergency Mode: Scanned invoice passed. Please bill manually."
        };

    } catch (error: any) {
        console.error('Emergency creation error:', error)
        return { error: `Failed to create patient: ${error.message}` }
    }
}

export async function createPatientQuick(formData: FormData) {
    return { error: "Use full form" };
}
