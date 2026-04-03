/**
 * User Management Server Actions
 * 
 * Handles user invitation, role assignment, and user management operations
 */

'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { sendInvitationEmail } from '@/lib/email'
import crypto from 'crypto'
import { headers } from 'next/headers'
import os from 'os'

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (!iface) continue;
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}


export interface InviteUserData {
    email: string
    roleId?: string
    systemRole: 'admin' | 'user'
    fullName?: string
    username?: string
    mobile?: string
    countryId?: string
    subdivisionId?: string
    holidayIds?: string[]
}

/**
 * Get all users for the current tenant with roles
 */
export async function getUsers(filters?: {
    search?: string
    role?: string
    status?: 'active' | 'inactive' | 'all'
    page?: number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    try {
        const page = filters?.page || 1
        const limit = filters?.limit || 20
        const skip = (page - 1) * limit

        const where: any = {
            tenant_id: session.user.tenantId,
        }

        // Search filter
        if (filters?.search) {
            where.OR = [
                { email: { contains: filters.search, mode: 'insensitive' } },
                { full_name: { contains: filters.search, mode: 'insensitive' } },
                { name: { contains: filters.search, mode: 'insensitive' } },
            ]
        }

        // Role filter
        if (filters?.role && filters.role !== 'all') {
            where.role = filters.role
        }

        // Status filter
        if (filters?.status && filters?.status !== 'all') {
            where.is_active = filters.status === 'active'
        }

        // 1. Fetch Users
        const [usersRaw, total] = await Promise.all([
            prisma.app_user.findMany({
                where,
                // TODO: Add country and subdivision includes when geography tables are added
                // include: {
                //     country: { select: { name: true, flag: true } },
                //     subdivision: { select: { name: true, type: true } }
                // },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip,
            }),
            prisma.app_user.count({ where })
        ])

        // 2. Fetch User Roles (Manual Join)
        const userIds = usersRaw.map(u => u.id)

        const userRolesRaw = await prisma.user_role.findMany({
            where: {
                user_id: { in: userIds },
                tenant_id: session.user.tenantId
            }
        })

        // 3. Fetch Role Names
        const roleIds = [...new Set(userRolesRaw.map(ur => ur.role_id))]
        const roles = await prisma.role.findMany({
            where: { id: { in: roleIds } }
        })
        const roleMap = new Map(roles.map(r => [r.id, r]))

        // 4. Stitch Relations
        // We map it to 'hms_user_roles' structure to keep frontend compatible for now
        const users = usersRaw.map(user => {
            const myRoleIds = userRolesRaw
                .filter(ur => ur.user_id === user.id)
                .map(ur => ur.role_id)

            const myRoles = myRoleIds
                .map(id => roleMap.get(id))
                .filter(r => r !== undefined) as any[]

            return {
                ...user,
                // Mocking the structure expected by <UserTable />
                hms_user_roles: myRoles.map(r => ({
                    hms_role: {
                        id: r.id,
                        name: r.name
                    }
                }))
            }
        })

        return {
            users,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        }

    } catch (error) {
        console.error('Error fetching users:', error)
        return { users: [], total: 0, pages: 0, currentPage: 1 }
    }
}

/**
 * Invite a new user to the system
 */
export async function inviteUser(data: InviteUserData) {
    const session = await auth()
    if (!session?.user?.tenantId) {
        return { error: 'Unauthorized' }
    }

    try {
        // Check if user already exists
        const existingUser = await prisma.app_user.findFirst({
            where: {
                email: data.email,
                tenant_id: session.user.tenantId,
            }
        })

        if (existingUser) {
            return { error: 'User with this email already exists' }
        }

        // Fetch default company or first available company for the tenant
        const defaultCompany = await prisma.company.findFirst({
            where: { tenant_id: session.user.tenantId },
            orderBy: { created_at: 'asc' } // Use first created company if no explicit default
        })

        // Create user with PENDING state (is_active: false)
        const user = await prisma.app_user.create({
            data: {
                tenant_id: session.user.tenantId,
                company_id: defaultCompany?.id, // FIX: Assign default company to prevent Unauthorized errors
                email: data.email.toLowerCase(),
                full_name: data.fullName || data.email.split('@')[0],
                name: data.username || data.email.split('@')[0],
                role: data.systemRole,
                // TODO: Add mobile, country_id, subdivision_id when schema is updated
                // mobile: data.mobile,
                // country_id: data.countryId,
                // subdivision_id: data.subdivisionId,
                is_tenant_admin: data.systemRole === 'admin',
                is_admin: data.systemRole === 'admin',
                // Persist extended fields in metadata to avoid schema dependency
                metadata: {
                    source: 'staff-onboarding',
                    onboarded_at: new Date().toISOString(),
                    mobile: data.mobile,
                    country_id: data.countryId,
                    subdivision_id: data.subdivisionId,
                    holidays_assigned: data.holidayIds
                }
            }
        })

        let inviteLink: string | undefined;
        let emailError = null;

        try {
            const token = crypto.randomBytes(32).toString('hex')
            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + 48)

            await prisma.email_verification_tokens.create({
                data: {
                    user_id: user.id,
                    email: user.email,
                    token: token,
                    expires_at: expiresAt
                }
            })

            const tenant = await prisma.tenant.findUnique({
                where: { id: session.user.tenantId },
                select: { logo_url: true, app_name: true }
            })

            const emailResult = await sendInvitationEmail(
                user.email,
                token,
                user.full_name || user.name || 'User',
                tenant?.logo_url,
                tenant?.app_name || undefined
            )
            if (!emailResult.success) {
                console.error("Resend Error:", emailResult.error)
                emailError = typeof emailResult.error === 'string' ? emailResult.error : 'API Key missing or Sandbox restriction';
            }

            // Determine APP URL dynamically for Production Ready setup
            // This is critical for LAN/Hospital deployments where process.env.NEXT_PUBLIC_APP_URL might be wrong or local
            let host = (await headers()).get('host')
            if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
                const localIp = getLocalIp();
                if (localIp !== '127.0.0.1') {
                    host = host.replace('localhost', localIp).replace('127.0.0.1', localIp);
                }
            }
            
            const isLocal = host?.includes('localhost') || host?.includes('127.0.0.1') || /^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/.test(host || '');
            const protocol = isLocal ? 'http' : 'https'
            const appUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://cloud-hms.onrender.com'));
            inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;

        } catch (e) {
            console.error("Error in invitation flow:", e)
            emailError = "Internal system error during mail generation";
        }

        if (data.roleId && data.roleId !== 'no-role') {
            try {
                // Fetch the Core Role to verify and get key
                const coreRole = await prisma.role.findUnique({
                    where: { id: data.roleId }
                })

                if (coreRole) {
                    // 1. Assign Core Role (Permissions) - Single Source of Truth
                    await prisma.user_role.create({
                        data: {
                            user_id: user.id,
                            role_id: coreRole.id,
                            tenant_id: session.user.tenantId
                        }
                    })

                    // 2. Legacy string fallback (Optimization for session)
                    // We stick to standard roles for the session string to avoid breaking legacy checks
                    const key = coreRole.key || coreRole.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (['receptionist', 'admin', 'doctor', 'nurse', 'pharmacist', 'labtechnician'].includes(key)) {
                        await prisma.app_user.update({
                            where: { id: user.id },
                            data: { role: key }
                        });
                    }
                }
            } catch (roleError) {
                console.error("Error assigning role:", roleError);
            }
        }

        // Assign Holidays (Mandatory Logic per user request)
        if (data.holidayIds && data.holidayIds.length > 0) {
            try {
                // Use createMany if database supports it (Postgres does)
                // Casting to any to bypass current Prisma Client generation issues
                const payload = data.holidayIds.map((hid: string) => ({
                    user_id: user.id,
                    holiday_id: hid
                }));

                await (prisma as any).hms_user_holiday.createMany({
                    data: payload,
                    skipDuplicates: true
                });
            } catch (holidayErr) {
                console.error("Error assigning holidays:", holidayErr);
                // Don't fail the whole Invite process, but log it.
            }
        }

        revalidatePath('/settings/users')

        return {
            success: true,
            message: emailError ? `User created but EMAIL FAILED: ${emailError}` : 'User invited successfully.',
            user,
            inviteLink,
            emailStatus: emailError ? 'failed' : 'sent'
        }

    } catch (error: any) {
        console.error('Error inviting user:', error)
        return { error: error.message || 'Failed to invite user' }
    }
}

/**
 * Resend invitation to an existing user
 */
export async function resendInvitation(userId: string) {
    const session = await auth()
    if (!session?.user?.tenantId) return { error: 'Unauthorized' }

    const user = await prisma.app_user.findUnique({
        where: { id: userId, tenant_id: session.user.tenantId }
    })

    if (!user) return { error: 'User not found' }

    if (user.password && user.is_active) {
        return { error: 'User has already activated their account' }
    }

    let emailError = null;
    let inviteLink: string | undefined;

    try {
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 48)

        await prisma.email_verification_tokens.deleteMany({
            where: { user_id: userId }
        })

        await prisma.email_verification_tokens.create({
            data: {
                user_id: user.id,
                email: user.email,
                token: token,
                expires_at: expiresAt
            }
        })

        const tenant = await prisma.tenant.findUnique({
            where: { id: session.user.tenantId },
            select: { logo_url: true, app_name: true }
        })

        const emailResult = await sendInvitationEmail(
            user.email,
            token,
            user.full_name || user.name || 'User',
            tenant?.logo_url,
            tenant?.app_name || undefined
        )

        if (!emailResult.success) {
            emailError = typeof emailResult.error === 'string' ? emailResult.error : 'Mail delivery failed (Check API Key/Sandbox)';
        }

        let host = (await headers()).get('host')
        if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
            const localIp = getLocalIp();
            if (localIp !== '127.0.0.1') {
                host = host.replace('localhost', localIp).replace('127.0.0.1', localIp);
            }
        }
        
        const isLocal = host?.includes('localhost') || host?.includes('127.0.0.1') || /^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/.test(host || '');
        const protocol = isLocal ? 'http' : 'https'
        const appUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://cloud-hms.onrender.com'));
        inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;

    } catch (e) {
        console.error("Resend error:", e)
        emailError = "Internal system failure";
    }

    return {
        success: true,
        message: emailError ? `Email failed: ${emailError}` : 'Invitation resent successfully.',
        inviteLink,
        emailStatus: emailError ? 'failed' : 'sent'
    }
}

/**
 * Update user status (activate/deactivate)
 */
export async function updateUserStatus(userId: string, isActive: boolean) {
    const session = await auth()
    if (!session?.user?.tenantId) {
        return { error: 'Unauthorized' }
    }

    try {
        await prisma.app_user.update({
            where: {
                id: userId,
                tenant_id: session.user.tenantId,
            },
            data: {
                is_active: isActive,
            }
        })

        revalidatePath('/settings/users')
        return { success: true }

    } catch (error) {
        console.error('Error updating user status:', error)
        return { error: 'Failed to update user status' }
    }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, systemRole: 'admin' | 'user') {
    const session = await auth()
    if (!session?.user?.tenantId) {
        return { error: 'Unauthorized' }
    }

    try {
        await prisma.app_user.update({
            where: {
                id: userId,
                tenant_id: session.user.tenantId,
            },
            data: {
                role: systemRole,
            }
        })

        revalidatePath('/settings/users')
        return { success: true }

    } catch (error) {
        console.error('Error updating user role:', error)
        return { error: 'Failed to update user role' }
    }
}

/**
 * Get all available roles for assignment
 */
export async function getAvailableRoles() {
    const session = await auth()
    if (!session?.user?.tenantId) return []

    try {
        const roles = await prisma.role.findMany({
            where: {
                tenant_id: session.user.tenantId,
            },
            select: {
                id: true,
                name: true,
                // description: true, // Field does not exist in Core Role table
            },
            orderBy: { name: 'asc' }
        })

        return roles.map(r => ({
            ...r,
            description: r.name // Fallback: Core Role table relies on name/key
        }))

    } catch (error) {
        console.error('Error fetching roles:', error)
        return []
    }
}

/**
 * Delete user (soft delete)
 */
export async function deleteUser(userId: string) {
    const session = await auth()
    if (!session?.user?.tenantId) {
        return { error: 'Unauthorized' }
    }

    try {
        if (userId === session.user.id) {
            return { error: 'Cannot delete your own account' }
        }

        await prisma.app_user.update({
            where: {
                id: userId,
                tenant_id: session.user.tenantId,
            },
            data: {
                is_active: false,
            }
        })

        revalidatePath('/settings/users')
        return { success: true, message: 'User deactivated successfully' }

    } catch (error) {
        console.error('Error deleting user:', error)
        return { error: 'Failed to delete user' }
    }
}

/**
 * Accept invitation and set password
 */
export async function acceptInvitation(token: string, password: string) {
    try {
        const tokenRecord = await prisma.email_verification_tokens.findFirst({
            where: { token: token }
        })

        if (!tokenRecord) {
            return { error: 'Invalid token' }
        }

        if (new Date() > tokenRecord.expires_at) {
            return { error: 'Token expired' }
        }

        const userId = tokenRecord.user_id

        // SELF-HEALING: Ensure pgcrypto exists for crypt()/gen_salt()
        try {
            await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        } catch (e) {
            console.warn("Security Extension Check:", (e as any).message);
        }

        await prisma.$executeRaw`
            UPDATE app_user 
            SET password = crypt(${password}, gen_salt('bf')),
                is_active = true
            WHERE id = ${userId}::uuid
        `

        await prisma.email_verification_tokens.delete({
            where: { id: tokenRecord.id }
        })

        return { success: true }
    } catch (error) {
        console.error("Accept invite error:", error)
        return { error: 'Failed to process invitation. Please try again.' }
    }
}

/**
 * Permanently delete user if no transactions exist
 */
export async function deleteUserPermanently(userId: string) {
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
        return { error: "Unauthorized" }
    }

    try {
        // Resolve Clinician ID if they exist in HMS
        const clinician = await prisma.hms_clinicians.findFirst({
            where: { user_id: userId, tenant_id: session.user.tenantId }
        })

        // Resolve CRM Employee if they exist
        const employee = await prisma.crm_employee.findFirst({
            where: { user_id: userId, tenant_id: session.user.tenantId }
        })

        const [
            clinicalEncounters,
            clinicalAppointments,
            deals,
            contacts
        ] = await Promise.all([
            clinician ? prisma.hms_encounter.count({ where: { clinician_id: clinician.id } }) : 0,
            clinician ? prisma.hms_appointments.count({ where: { clinician_id: clinician.id } }) : 0,
            prisma.crm_deals.count({ where: { owner_id: userId } }),
            prisma.crm_contacts.count({ where: { owner_id: userId } }),
        ])

        const totalTransactions = clinicalEncounters + clinicalAppointments + deals + contacts

        if (totalTransactions > 0) {
            const details = [
                clinicalEncounters ? `${clinicalEncounters} Clinical Encounters` : '',
                clinicalAppointments ? `${clinicalAppointments} Scheduled Appointments` : '',
                deals ? `${deals} CRM Deals` : '',
                contacts ? `${contacts} CRM Contacts` : ''
            ].filter(Boolean).join(', ')

            return {
                error: `Action Blocked: This user has historical data that must be preserved. Permanent deletion failed. Details: ${details}. Please de-activate the user instead.`
            }
        }

        await prisma.hms_user_roles.deleteMany({ where: { user_id: userId } })
        await prisma.user_permission.deleteMany({ where: { user_id: userId } })
        await prisma.email_verification_tokens.deleteMany({ where: { user_id: userId } })

        // Atomic cleanup of linked records if they exist without transactions
        if (clinician) await prisma.hms_clinicians.delete({ where: { id: clinician.id } })
        if (employee) await prisma.crm_employee.delete({ where: { id: employee.id } })

        await prisma.app_user.delete({ where: { id: userId } })

        revalidatePath('/settings/users')
        return { success: true }

    } catch (error: any) {
        console.error("Delete user error:", error)
        if (error.code === 'P2003') {
            return { error: `Cannot delete user due to foreign key constraint: ${error.meta?.field_name || 'Unknown Table'}` }
        }
        return { error: error.message || "Failed to delete user" }
    }
}

/**
 * Bulk invite multiple users at once
 */
export async function bulkInviteUsers(users: { email: string; fullName?: string; roleId?: string; systemRole: 'admin' | 'user' }[]) {
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
        return { error: "Unauthorized" }
    }

    const results = {
        total: users.length,
        invited: 0,
        failed: 0,
        errors: [] as string[]
    }

    for (const userData of users) {
        try {
            const res = await inviteUser({
                email: userData.email,
                fullName: userData.fullName,
                roleId: userData.roleId,
                systemRole: userData.systemRole
            })
            if (res.success) {
                results.invited++
            } else {
                results.failed++
                results.errors.push(`${userData.email}: ${res.error}`)
            }
        } catch (e: any) {
            results.failed++
            results.errors.push(`${userData.email}: ${e.message}`)
        }
    }

    revalidatePath('/settings/users')
    return { success: true, results }
}
