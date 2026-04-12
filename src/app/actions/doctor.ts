'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { randomUUID } from "crypto"

export async function createDoctor(formData: FormData) {
    const session = await auth()
    const tenantId = session?.user?.tenantId
    const companyId = session?.user?.companyId

    if (!tenantId || !companyId) {
        return { error: "Unauthorized: Missing session context" }
    }

    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const email = formData.get("email") as string
    const employeeId = formData.get("employee_id") as string
    const designation = formData.get("designation") as string
    const roleId = formData.get("role_id") as string
    const specializationId = formData.get("specialization_id") as string
    const departmentId = formData.get("department_id") as string
    const licenseNo = formData.get("license_no") as string
    const experienceYears = parseInt(formData.get("experience_years") as string) || 0
    const qualification = formData.get("qualification") as string // UI only for now as schema lacks it

    const consultationStartTime = formData.get("consultation_start_time") as string || "09:00"
    const consultationEndTime = formData.get("consultation_end_time") as string || "17:00"
    const consultationSlotDuration = parseInt(formData.get("consultation_slot_duration") as string) || 30
    const consultationFee = parseFloat(formData.get("consultation_fee") as string) || 0
    const workingDays = formData.getAll("working_days") as string[]
    const profileImageUrl = formData.get("profile_image_url") as string
    const signatureUrl = formData.get("signature_url") as string
    const salutation = formData.get("salutation") as string || "Dr."
    const documentUrlsStr = formData.get("document_urls") as string
    const documentUrls = documentUrlsStr ? JSON.parse(documentUrlsStr) : []

    if (!firstName) return { error: "First Name is required" }
    if (!lastName) return { error: "Last Name is required" }
    if (!email) return { error: "Professional Email is required" }
    if (!roleId) return { error: "Institutional Role is required" }

    try {
        // WORLD-CLASS: Link to Accounts Head (Employee Payables)
        // We look for the Employee Payable or Salary Payable account for this tenant
        const employeePayableAccount = await prisma.account_chart.findFirst({
            where: {
                tenant_id: tenantId,
                name: { contains: 'Employee Payable', mode: 'insensitive' }
            }
        })

        // Create Clinician
        const newClinician = await prisma.hms_clinicians.create({
            data: {
                id: randomUUID(),
                tenant_id: tenantId,
                company_id: companyId,
                first_name: firstName,
                last_name: lastName,
                salutation: salutation,
                email: email,
                employee_id: employeeId || null,
                designation: designation || null,
                qualification: qualification || null,
                license_no: licenseNo || null,
                experience_years: experienceYears,
                role_id: roleId,
                specialization_id: specializationId || null,
                department_id: departmentId || null,
                consultation_start_time: consultationStartTime,
                consultation_end_time: consultationEndTime,
                consultation_slot_duration: consultationSlotDuration,
                consultation_fee: consultationFee,
                // @ts-ignore
                working_days: (Array.isArray(workingDays) && workingDays.length > 0)
                    ? workingDays.filter(d => !!d)
                    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                profile_image_url: profileImageUrl || null,
                signature_url: signatureUrl || null,
                document_urls: Array.isArray(documentUrls) ? documentUrls : [],
                is_active: true,
            }
        })

        revalidatePath("/hms/doctors")
        return { success: true, clinicianId: newClinician.id }
    } catch (error: any) {
        console.error("Failed to create world-class clinician:", error)
        return { error: error.message || "Failed to create clinician" }
    }
}

export async function updateDoctor(formData: FormData) {
    const session = await auth()
    const tenantId = session?.user?.tenantId

    if (!tenantId) return { error: "Unauthorized" }

    const id = formData.get("id") as string
    const firstName = formData.get("first_name") as string
    const lastName = formData.get("last_name") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string
    const employeeId = formData.get("employee_id") as string
    const designation = formData.get("designation") as string
    const licenseNo = formData.get("license_no") as string
    const salutation = formData.get("salutation") as string
    const roleId = formData.get("role_id") as string
    const specializationId = formData.get("specialization_id") as string
    const departmentId = formData.get("department_id") as string
    const experienceYears = parseInt(formData.get("experience_years") as string) || 0

    const consultationStartTime = formData.get("consultation_start_time") as string
    const consultationEndTime = formData.get("consultation_end_time") as string
    const consultationSlotDuration = parseInt(formData.get("consultation_slot_duration") as string)
    const consultationFee = parseFloat(formData.get("consultation_fee") as string) || 0
    const workingDays = formData.getAll("working_days") as string[]
    const profileImageUrl = formData.get("profile_image_url") as string
    const signatureUrl = formData.get("signature_url") as string
    const documentUrlsStr = formData.get("document_urls") as string
    const documentUrls = documentUrlsStr ? JSON.parse(documentUrlsStr) : []

    try {
        await prisma.hms_clinicians.update({
            where: { id, tenant_id: tenantId },
            data: {
                first_name: firstName,
                last_name: lastName,
                salutation: salutation,
                email: email,
                phone: phone,
                employee_id: employeeId || null,
                designation: designation || null,
                qualification: formData.get("qualification") as string || null,
                license_no: licenseNo,
                role_id: roleId,
                specialization_id: specializationId || null,
                department_id: departmentId || null,
                experience_years: experienceYears,
                consultation_start_time: consultationStartTime,
                consultation_end_time: consultationEndTime,
                consultation_slot_duration: consultationSlotDuration,
                consultation_fee: consultationFee,
                // @ts-ignore
                working_days: (Array.isArray(workingDays) && workingDays.length > 0) ? workingDays.filter(d => !!d) : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                profile_image_url: profileImageUrl || null,
                signature_url: signatureUrl || null,
                document_urls: Array.isArray(documentUrls) ? documentUrls : [],
                updated_at: new Date()
            }
        })
        revalidatePath("/hms/doctors")
        return { success: true }
    } catch (error: any) {
        console.error("Failed to update clinician:", error)
        return { error: error.message || "Failed to update clinician" }
    }
}

export async function initializeDoctorProfile(_formData: FormData) {
    const session = await auth()
    if (!session?.user?.email || !session?.user?.tenantId) {
        return { error: "Unauthorized" }
    }

    // 🚨 EMERGENCY DATABASE REPAIR (On-the-fly)
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE hms_clinicians ALTER COLUMN working_days DROP DEFAULT;
            ALTER TABLE hms_clinicians ALTER COLUMN working_days SET DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[];
            ALTER TABLE hms_clinicians ALTER COLUMN working_days DROP NOT NULL;
        `);
    } catch (e) {
        console.log('Database repair shim skipped or already patched');
    }

    const { email, name, tenantId, companyId, id: userId } = session.user

    // Safety check: Logic Updated for World Class Linkage
    // 1. Try finding by user_id first (Immutable Link)
    let existing = await prisma.hms_clinicians.findFirst({
        where: { user_id: userId, tenant_id: tenantId }
    })

    // 2. If not linked, try finding by Email (Legacy/First-time Link)
    if (!existing) {
        existing = await prisma.hms_clinicians.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, tenant_id: tenantId }
        })

        // If found by email but not linked, LINK IT NOW (Lazy Migration)
        if (existing && !existing.user_id) {
            await prisma.hms_clinicians.update({
                where: { id: existing.id },
                data: { user_id: userId }
            })
        }
    }

    if (existing) {
        revalidatePath('/hms/doctor/dashboard')
        redirect('/hms/doctor/dashboard')
    }

    // Attempt to get a default role
    const defaultRole = await prisma.hms_roles.findFirst({
        where: { tenant_id: tenantId, name: { contains: 'Doctor', mode: 'insensitive' } }
    })

    const [firstName, ...rest] = (name || 'New Doctor').split(' ')
    const lastName = rest.join(' ') || ''

    try {
        // WORLD-CLASS FIX: Use tagged template literal $executeRaw for safety
        await prisma.$executeRaw`
            INSERT INTO hms_clinicians (
                id, tenant_id, company_id, first_name, last_name, salutation,
                email, user_id, is_active, consultation_fee, 
                consultation_slot_duration, consultation_start_time, 
                consultation_end_time, working_days
            ) VALUES (
                ${randomUUID()}, 
                ${tenantId}, 
                ${companyId || tenantId}, 
                ${firstName}, 
                ${lastName}, 
                ${(firstName.toLowerCase().includes('dr') || (name && name.toLowerCase().includes('dr'))) ? 'Dr.' : 'Mr.'},
                ${email}, 
                ${userId}, 
                true, 
                500, 
                30, 
                "09:00", 
                "17:00",
                ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']}
            )
        `;

        revalidatePath('/hms/doctor/dashboard')
        redirect('/hms/doctor/dashboard')
    } catch (error: any) {
        console.error("Failed to auto-init doctor:", error)
        return { error: "Failed to initialize profile. " + error.message }
    }
}

export async function deleteClinician(id: string) {
    const session = await auth()
    const tenantId = session?.user?.tenantId
    const isAdmin = session?.user?.isAdmin

    if (!tenantId || !isAdmin) {
        return { error: "Unauthorized: Admin access required for permanent removal" }
    }

    try {
        // WORLD-CLASS SAFETY: Check for transaction history
        const [appointmentCount, encounterCount] = await Promise.all([
            prisma.hms_appointments.count({
                where: { clinician_id: id, tenant_id: tenantId }
            }),
            prisma.hms_encounter.count({
                where: { clinician_id: id, tenant_id: tenantId }
            })
        ])

        if (appointmentCount > 0 || encounterCount > 0) {
            return { error: "This personnel has clinical history (appointments/encounters). Permanent deletion is blocked to maintain record integrity. Please use 'Inactive' status instead." }
        }

        await prisma.hms_clinicians.delete({
            where: { id, tenant_id: tenantId }
        })

        revalidatePath("/hms/doctors")
        return { success: true }
    } catch (error: any) {
        console.error("Failed to delete clinician:", error)
        return { error: "Internal Error: Could not remove record. They may have linked metadata." }
    }
}
