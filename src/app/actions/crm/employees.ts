
'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function createEmployee(data: {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    designation_id?: string | null;
    department_id?: string | null;
    supervisor_id?: string | null;
    branch_id?: string | null;
    office?: string;
    category?: string;
    status?: string;
    password?: string;
    username?: string;
    role?: string;
    address?: string;
    city?: string;
    pincode?: string;
    country?: string;
    state?: string;
    district?: string;
    targetType?: string;
    targetCycle?: string;
    targets?: Record<string, string>;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const employeeId = crypto.randomUUID();
        let userId: string | undefined;

        if (data.email && data.password) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(data.password, 10);

            const user = await prisma.app_user.create({
                data: {
                    tenant_id: session.user.tenantId,
                    company_id: session.user.companyId,
                    email: data.email,
                    name: `${data.first_name} ${data.last_name || ''}`.trim(),
                    password: hashedPassword,
                    role: data.role || 'user',
                    is_active: true
                }
            });
            userId = user.id;
        }

        const employee = await prisma.crm_employee.create({
            data: {
                id: employeeId,
                tenant_id: session.user.tenantId,
                company_id: session.user.companyId,
                user_id: userId,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
                designation_id: data.designation_id || undefined,
                department_id: data.department_id || undefined,
                supervisor_id: (data.supervisor_id === 'none' ? undefined : data.supervisor_id) as any,
                branch_id: data.branch_id || undefined,
                office: data.office,
                category: data.category,
                status: data.status || 'active',
                present_address: data.address,
                metadata: {
                    city: data.city,
                    pincode: data.pincode,
                    country: data.country,
                    state: data.state,
                    district: data.district
                }
            }
        });

        // Handle targets
        if (data.targets && Object.values(data.targets).some(v => v !== '')) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            const currentYear = new Date().getFullYear();

            const targetPromises = months.map((month, index) => {
                const value = data.targets?.[month];
                if (!value || value === '' || parseFloat(value) === 0) return null;

                const startDate = new Date(currentYear, index, 1);
                const endDate = new Date(currentYear, index + 1, 0);

                return prisma.crm_targets.create({
                    data: {
                        tenant_id: session.user.tenantId,
                        assignee_type: data.targetType === 'team' ? 'team' : 'user',
                        assignee_id: userId || employeeId, // Prefer userId for targets if exists
                        period_type: 'month',
                        period_start: startDate,
                        period_end: endDate,
                        target_type: 'revenue', // Defaulting to revenue
                        target_value: parseFloat(value),
                        achieved_value: 0
                    }
                });
            }).filter(Boolean);

            if (targetPromises.length > 0) {
                await Promise.all(targetPromises);
            }
        }

        revalidatePath('/crm/employees');
        return { success: true, employeeId: employee.id };
    } catch (error: any) {
        console.error("Failed to create employee:", error);
        if (error.code === 'P2002') {
            return { error: "An employee with this email already exists." };
        }
        return { error: "Failed to create employee record." };
    }
}


export async function getEmployeeMasters() {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) return { error: "Unauthorized" };

    try {
        const companyId = session.user.companyId;
        if (!companyId) return { success: true, designations: [], branches: [], departments: [], supervisors: [] };

        const [designations, branches, departments, supervisors] = await Promise.all([
            prisma.crm_designation.findMany({
                where: { tenant_id: session.user.tenantId, is_active: true },
                orderBy: { name: 'asc' }
            }),
            prisma.hms_branch.findMany({
                where: { company_id: companyId, is_active: true },
                orderBy: { name: 'asc' }
            }),
            prisma.hms_departments.findMany({
                where: { tenant_id: session.user.tenantId, deleted_at: null },
                orderBy: { name: 'asc' }
            }),
            prisma.crm_employee.findMany({
                where: { tenant_id: session.user.tenantId, status: 'active' },
                select: { id: true, first_name: true, last_name: true },
                orderBy: { first_name: 'asc' }
            })
        ]);

        return { success: true, designations, branches, departments, supervisors };
    } catch (error) {
        return { error: "Failed to fetch master data" };
    }
}

export async function getEmployees() {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) return [];

    return prisma.crm_employee.findMany({
        where: { tenant_id: session.user.tenantId },
        include: {
            designation: true,
            branch: true,
            department: true,
            // @ts-ignore
            supervisor: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true
                }
            }
        },
        orderBy: { first_name: 'asc' }
    });
}

export async function getEmployee(id: string) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) return null;

    return prisma.crm_employee.findUnique({
        where: { id, tenant_id: session.user.tenantId },
        include: {
            designation: true,
            branch: true,
            department: true,
            // @ts-ignore
            supervisor: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true
                }
            }
        }
    });
}

export async function updateEmployee(id: string, data: {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    designation_id?: string | null;
    department_id?: string | null;
    supervisor_id?: string | null;
    branch_id?: string | null;
    office?: string;
    category?: string;
    status?: string;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.crm_employee.update({
            where: { id, tenant_id: session.user.tenantId },
            data: {
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
                designation_id: data.designation_id, // Pass null explicitly to disconnect
                department_id: data.department_id,
                // @ts-ignore
                supervisor_id: data.supervisor_id,
                branch_id: data.branch_id,
                office: data.office,
                category: data.category,
                status: data.status
            }
        });

        revalidatePath('/crm/employees');
        revalidatePath(`/crm/employees/${id}`);
        revalidatePath('/crm/org-chart');
        revalidatePath('/crm/departments');
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update employee:", error);
        return { error: "Failed to update employee record." };
    }
}

export async function deleteEmployee(id: string) {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        // [SAFETY] Check for history before deleting employee directly
        const employee = await prisma.crm_employee.findUnique({
            where: { id, tenant_id: session.user.tenantId }
        });

        if (employee?.user_id) {
            const clinician = await prisma.hms_clinicians.findFirst({
                where: { user_id: employee.user_id, tenant_id: session.user.tenantId }
            });

            const [clinicalHistory, deals, contacts] = await Promise.all([
                clinician ? prisma.hms_appointments.count({ where: { clinician_id: clinician.id } }) : 0,
                prisma.crm_deals.count({ where: { owner_id: employee.user_id } }),
                prisma.crm_contacts.count({ where: { owner_id: employee.user_id } }),
            ]);

            if (clinicalHistory + deals + contacts > 0) {
                return { error: "Action Blocked: Employee has historical clinical or CRM data and cannot be permanently removed. Please set status to 'Inactive' instead." };
            }
        }

        await prisma.crm_employee.delete({
            where: { id, tenant_id: session.user.tenantId }
        });

        revalidatePath('/crm/employees');
        revalidatePath('/crm/org-chart');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete employee:", error);
        return { error: "Failed to delete employee record. They might have related data." };
    }
}

