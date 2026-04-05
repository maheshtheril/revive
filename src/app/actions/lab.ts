'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateStatusSchema = z.object({
    orderId: z.string().uuid(),
    status: z.enum(['requested', 'collected', 'in_progress', 'completed', 'cancelled']),
})

export async function updateLabOrderStatus(input: z.infer<typeof updateStatusSchema>) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" }
    }

    const { orderId, status } = input

    try {
        // Update the main order status
        // AND update all line items if we are moving to a terminal state or uniform state?
        // For simplicity, let's sync line items to the order status if moving forward,
        // unless line items are handled individually (which is more complex, but requested = "world standard").
        // "World standard" usually implies granular control BUT automated convenience.

        // Let's update the order status
        const order = await prisma.hms_lab_order.update({
            where: { id: orderId },
            data: { status }
        })

        // Also update line items to match, if applicable. 
        // If order is 'completed', all lines should be 'completed'.
        // If order is 'collected', lines are 'collected'.
        // This is a simplification but good for now.
        await prisma.hms_lab_order_line.updateMany({
            where: { order_id: orderId },
            data: { status: status === 'in_progress' ? 'processing' : status } // Mapping nuances if any
        })

        revalidatePath('/hms/lab/dashboard')
        return { success: true, message: "Order status updated successfully", data: order }
    } catch (error) {
        console.error("Failed to update lab order status:", error)
        return { success: false, message: "Failed to update status" }
    }
}

const updateReportSchema = z.object({
    orderId: z.string().uuid(),
    reportUrl: z.string() // Removed .url() to allow Data URIs which might be long
})

export async function updateLabOrderReport(input: z.infer<typeof updateReportSchema>) {
    const session = await auth()
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" }
    }

    const { orderId, reportUrl } = input

    try {
        const order = await prisma.hms_lab_order.update({
            where: { id: orderId },
            data: {
                report_url: reportUrl,
                status: 'completed' // Auto-complete when report is uploaded? usually yes.
            }
        })

        // Also update all lines to completed
        await prisma.hms_lab_order_line.updateMany({
            where: { order_id: orderId },
            data: { status: 'completed' }
        })

        revalidatePath('/hms/lab/dashboard')
        revalidatePath('/hms/doctor/dashboard') // Ensure doctor sees it
        return { success: true, message: "Report uploaded successfully", data: order }
    } catch (error) {
        console.error("Failed to upload lab report:", error)
        return { success: false, message: "Failed to upload report: " + (error as Error).message }
    }
}

export async function getLabReportForAppointment(appointmentId: string) {
    const session = await auth()
    if (!session?.user?.id) return { success: false }

    try {
        const order = await prisma.hms_lab_order.findFirst({
            where: {
                encounter_id: appointmentId,
                report_url: { not: null }
            },
            select: { report_url: true }
        })

        if (order?.report_url) {
            return { success: true, reportUrl: order.report_url }
        }
        return { success: false }
    } catch (error) {
        return { success: false }
    }
}

export async function uploadAndAttachLabReport(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;

    if (!file || !orderId) {
        return { success: false, message: "Missing file or order ID" };
    }

    try {
        // Validate file type
        const validTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (!validTypes.includes(file.type)) {
            return { success: false, message: "Invalid file type. Allowed: PDF, Images." };
        }

        // Validate size (e.g. 15MB)
        if (file.size > 15 * 1024 * 1024) {
            return { success: false, message: "File size must be less than 15MB" };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const base64String = buffer.toString('base64');
        const mimeType = file.type;
        const dataUri = `data:${mimeType};base64,${base64String}`;

        // Save to DB
        const order = await prisma.hms_lab_order.update({
            where: { id: orderId },
            data: {
                report_url: dataUri,
                status: 'completed'
            }
        })

        // Also update all lines to completed
        await prisma.hms_lab_order_line.updateMany({
            where: { order_id: orderId },
            data: { status: 'completed' }
        })

        revalidatePath('/hms/lab/dashboard');
        revalidatePath('/hms/doctor/dashboard');

        return { success: true, message: "Report uploaded successfully", url: dataUri };

    } catch (error: any) {
        console.error("Fatal Upload Error:", error);
        return { success: false, message: "Upload failed: " + error.message };
    }
}

export async function getPendingLabOrders() {
    const session = await auth()
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" }

    try {
        const orders = await prisma.hms_lab_order.findMany({
            where: {
                company_id: session.user.companyId,
                status: { in: ['requested', 'collected', 'in_progress'] }
            },
            include: {
                hms_patient: {
                    select: { first_name: true, last_name: true, patient_number: true }
                },
                hms_appointment: {
                    include: {
                        hms_clinician: {
                            select: { first_name: true, last_name: true }
                        }
                    }
                },
                hms_lab_order_lines: {
                    include: {
                        hms_lab_test: true,
                        hms_lab_result: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        return { success: true, data: orders }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getLabOrderForReporting(orderId: string) {
    const session = await auth()
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" }

    try {
        const order = await prisma.hms_lab_order.findUnique({
            where: { id: orderId },
            include: {
                hms_patient: true,
                hms_appointment: {
                    include: {
                        hms_clinician: true
                    }
                },
                hms_lab_order_lines: {
                    include: {
                        hms_lab_test: true,
                        hms_lab_result: true
                    }
                }
            }
        })

        return { success: true, data: order }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function saveLabResults(data: {
    orderId: string,
    results: Array<{
        orderLineId: string,
        testId: string,
        value: string,
        remarks?: string,
        isVerified?: boolean
    }>
}) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const userId = session.user.id
        const tenantId = session.user.tenantId!
        const companyId = session.user.companyId!

        await prisma.$transaction(async (tx) => {
            for (const res of data.results) {
                // Check if result already exists
                const existing = await tx.hms_lab_result.findFirst({
                    where: { order_line_id: res.orderLineId }
                })

                if (existing) {
                    await tx.hms_lab_result.update({
                        where: { id: existing.id },
                        data: {
                            result_value: res.value,
                            interpreted_value: res.remarks,
                            verified_by: res.isVerified ? userId : null,
                            verified_at: res.isVerified ? new Date() : null,
                            reported_by: userId,
                            reported_at: new Date()
                        }
                    })
                } else {
                    await tx.hms_lab_result.create({
                        data: {
                            tenant_id: tenantId,
                            company_id: companyId,
                            order_line_id: res.orderLineId,
                            test_id: res.testId,
                            result_value: res.value,
                            interpreted_value: res.remarks,
                            reported_by: userId,
                            reported_at: new Date(),
                            verified_by: res.isVerified ? userId : null,
                            verified_at: res.isVerified ? new Date() : null
                        }
                    })
                }

                // Update line status
                await tx.hms_lab_order_lines.update({
                    where: { id: res.orderLineId },
                    data: { status: 'completed' }
                })
            }

            // check if all lines are completed
            const allLines = await tx.hms_lab_order_lines.findMany({
                where: { order_id: data.orderId }
            })
            const allDone = allLines.every(l => l.status === 'completed')

            if (allDone) {
                await tx.hms_lab_order.update({
                    where: { id: data.orderId },
                    data: { status: 'completed' }
                })
            }
        })

        revalidatePath('/hms/lab/dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteLabReport(orderId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await prisma.hms_lab_order.update({
            where: { id: orderId },
            data: {
                report_url: null,
                status: 'in_progress'
            }
        });

        revalidatePath('/hms/lab/dashboard');
        return { success: true, message: "Report deleted successfully" };
    } catch (error: any) {
        return { success: false, message: "Delete failed: " + error.message };
    }
}

export async function getLabTests() {
    const session = await auth()
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" }

    try {
        const tests = await prisma.hms_lab_test.findMany({
            where: { company_id: session.user.companyId },
            orderBy: { name: 'asc' }
        })
        return { success: true, data: tests }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function saveLabTest(data: any) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const tenantId = session.user.tenantId!
        const companyId = session.user.companyId!

        if (data.id) {
            const { id, ...rest } = data;
            await prisma.hms_lab_test.update({
                where: { id: id },
                data: {
                    ...rest,
                    tenant_id: tenantId,
                    company_id: companyId,
                    updated_at: new Date()
                }
            })
        } else {
            await prisma.hms_lab_test.create({
                data: {
                    ...data,
                    tenant_id: tenantId,
                    company_id: companyId
                }
            })
        }

        revalidatePath('/hms/lab/tests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteLabTest(id: string) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        await prisma.hms_lab_test.delete({
            where: { id }
        })
        revalidatePath('/hms/lab/tests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function seedStandardLabTests() {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const tenantId = session.user.tenantId!
        const companyId = session.user.companyId!

        const standardTests = [
            { name: 'Complete Blood Count (CBC)', price: 350, units: 'various', reference_range: 'Clinical Correlation' },
            { name: 'Blood Sugar (Fasting)', price: 100, units: 'mg/dL', reference_range: '70 - 110' },
            { name: 'Blood Sugar (Post Prandial)', price: 100, units: 'mg/dL', reference_range: '110 - 140' },
            { name: 'HbA1c', price: 650, units: '%', reference_range: '4.5 - 6.5' },
            { name: 'Lipid Profile', price: 950, units: 'mg/dL', reference_range: 'Multiple Ranges' },
            { name: 'Liver Function Test (LFT)', price: 1200, units: 'various', reference_range: 'See Report' },
            { name: 'Renal Function Test (RFT)', price: 850, units: 'various', reference_range: 'See Report' },
            { name: 'Thyroid Profile (T3, T4, TSH)', price: 750, units: 'uIU/mL', reference_range: '0.4 - 4.5' },
            { name: 'Urine Routine', price: 250, units: 'n/a', reference_range: 'Nil/Normal' },
            { name: 'Vitamin D3 / B12 Duo', price: 2500, units: 'ng/mL', reference_range: '30 - 100' },
            { name: 'CRP (Quantitative)', price: 550, units: 'mg/L', reference_range: '0 - 6' },
            { name: 'D-Dimer', price: 1800, units: 'ng/mL', reference_range: '0 - 500' },
            { name: 'PSA (Prostate Specific)', price: 1200, units: 'ng/mL', reference_range: '0 - 4.0' }
        ]

        for (const test of standardTests) {
            const existing = await prisma.hms_lab_test.findFirst({
                where: {
                    name: { equals: test.name, mode: 'insensitive' },
                    company_id: companyId
                }
            })
            if (!existing) {
                await prisma.hms_lab_test.create({
                    data: {
                        ...test,
                        tenant_id: tenantId,
                        company_id: companyId
                    }
                })
            }
        }

        revalidatePath('/hms/lab/tests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getLabConfig() {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const companyId = session.user.companyId!
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { metadata: true }
        })
        const meta = (company?.metadata as any) || {}
        return { success: true, data: meta.lab_config || {} }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function saveLabConfig(config: any) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const companyId = session.user.companyId!
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { metadata: true }
        })

        const currentMeta = (company?.metadata as any) || {}
        const newMeta = {
            ...currentMeta,
            lab_config: config
        }

        await prisma.company.update({
            where: { id: companyId },
            data: { metadata: newMeta }
        })

        revalidatePath('/hms/settings/lab')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function exportLabTestsAsJson() {
    const session = await auth()
    if (!session?.user?.companyId) return { success: false, error: "Unauthorized" }

    try {
        const tests = await prisma.hms_lab_test.findMany({
            where: { company_id: session.user.companyId },
            select: {
                name: true,
                price: true,
                units: true,
                reference_range: true,
                method: true,
                is_active: true
            }
        })
        return { success: true, data: tests }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function importLabTestsFromJson(tests: any[]) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    try {
        const tenantId = session.user.tenantId!
        const companyId = session.user.companyId!

        for (const test of tests) {
            const existing = await prisma.hms_lab_test.findFirst({
                where: {
                    name: { equals: test.name, mode: 'insensitive' },
                    company_id: companyId
                }
            })
            if (!existing) {
                await prisma.hms_lab_test.create({
                    data: {
                        ...test,
                        tenant_id: tenantId,
                        company_id: companyId
                    }
                })
            }
        }

        revalidatePath('/hms/lab/tests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function sendLabReportWhatsappAction(orderId: string) {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const tenantId = (session.user as any).tenant_id || (session.user as any).tenantId
    const { NotificationService } = await import("@/lib/services/notification")
    return await NotificationService.sendLabReportWhatsapp(orderId, tenantId)
}


