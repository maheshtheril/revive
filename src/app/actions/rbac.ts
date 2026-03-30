'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import * as crypto from 'crypto'

const STANDARD_PERMISSIONS = [
    // User Management -> System
    { code: 'users:view', name: 'View Users', module: 'System' },
    { code: 'users:create', name: 'Create Users', module: 'System' },
    { code: 'users:edit', name: 'Edit Users', module: 'System' },
    { code: 'users:delete', name: 'Delete Users', module: 'System' },

    // Role Management -> System
    { code: 'roles:view', name: 'View Roles', module: 'System' },
    { code: 'roles:manage', name: 'Manage Roles', module: 'System' },

    // Settings -> System
    { code: 'settings:view', name: 'View Settings', module: 'System' },
    { code: 'settings:edit', name: 'Edit Settings', module: 'System' },

    // HMS - General
    { code: 'hms:view', name: 'View HMS', module: 'HMS' },
    { code: 'hms:admin', name: 'HMS Administrator', module: 'HMS' },
    { code: 'hms:create', name: 'Create HMS Records', module: 'HMS' },
    { code: 'hms:edit', name: 'Edit HMS Records', module: 'HMS' },
    { code: 'hms:delete', name: 'Delete HMS Records', module: 'HMS' },

    // Dashboard Access
    { code: 'hms:dashboard:doctor', name: 'Access Doctor Dashboard', module: 'HMS' },
    { code: 'hms:dashboard:nurse', name: 'Access Nurse Dashboard', module: 'HMS' },
    { code: 'hms:dashboard:reception', name: 'Access Reception Dashboard', module: 'HMS' },
    { code: 'hms:dashboard:lab', name: 'Access Lab Dashboard', module: 'HMS' },
    { code: 'hms:dashboard:accounting', name: 'Access Accounting Dashboard', module: 'HMS' },


    // HMS - Clinical & Patient
    { code: 'patients:view', name: 'View Patients', module: 'HMS' },
    { code: 'patients:create', name: 'Create Patients', module: 'HMS' },
    { code: 'patients:edit', name: 'Edit Patients', module: 'HMS' },
    { code: 'appointments:view', name: 'View Appointments', module: 'HMS' },
    { code: 'appointments:create', name: 'Create Appointments', module: 'HMS' },
    { code: 'appointments:edit', name: 'Edit Appointments', module: 'HMS' },
    { code: 'prescriptions:view', name: 'View Prescriptions', module: 'HMS' },
    { code: 'prescriptions:create', name: 'Create Prescriptions', module: 'HMS' },
    { code: 'prescriptions:edit', name: 'Edit Prescriptions', module: 'HMS' },
    { code: 'vitals:view', name: 'View Vitals', module: 'HMS' },
    { code: 'vitals:create', name: 'Create Vitals', module: 'HMS' },
    { code: 'vitals:edit', name: 'Edit Vitals', module: 'HMS' },

    // Lab
    { code: 'lab:view', name: 'View Lab Results', module: 'HMS' },
    { code: 'lab:create', name: 'Create Lab Orders', module: 'HMS' },
    { code: 'lab:edit', name: 'Edit Lab Orders', module: 'HMS' },

    // Billing & Accounting
    { code: 'billing:view', name: 'View Billing', module: 'HMS' },
    { code: 'billing:create', name: 'Create Bills', module: 'HMS' },
    { code: 'billing:edit', name: 'Edit Bills', module: 'HMS' },
    { code: 'billing:returns:view', name: 'View Sales Returns', module: 'HMS' },
    { code: 'billing:returns:create', name: 'Create Sales Returns', module: 'HMS' },
    { code: 'accounting:view', name: 'View Accounting Dashboard', module: 'HMS' },
    { code: 'accounting:create', name: 'Create Vouchers', module: 'HMS' },

    // Pharmacy
    { code: 'pharmacy:view', name: 'View Pharmacy', module: 'Pharmacy' },
    { code: 'pharmacy:create', name: 'Create Pharmacy Records', module: 'Pharmacy' },
    { code: 'pharmacy:edit', name: 'Edit Pharmacy Records', module: 'Pharmacy' },

    // CRM
    { code: 'crm:view', name: 'View CRM', module: 'CRM' },
    { code: 'crm:admin', name: 'CRM Administrator', module: 'CRM' },
    { code: 'crm:view_all', name: 'View All CRM Records', module: 'CRM' },
    { code: 'crm:view_team', name: 'View Team CRM Records', module: 'CRM' },
    { code: 'crm:view_own', name: 'View Own CRM Records', module: 'CRM' },
    { code: 'crm:reports', name: 'View CRM Reports', module: 'CRM' },
    { code: 'crm:create_leads', name: 'Create Leads', module: 'CRM' },
    { code: 'crm:manage_deals', name: 'Manage Deals', module: 'CRM' },
    { code: 'crm:assign_leads', name: 'Assign Leads', module: 'CRM' },
    { code: 'crm:manage_own_deals', name: 'Manage Own Deals', module: 'CRM' },
    { code: 'leads:view', name: 'View Leads', module: 'CRM' },
    { code: 'leads:create', name: 'Create Leads', module: 'CRM' },
    { code: 'leads:edit', name: 'Edit Leads', module: 'CRM' },
    { code: 'leads:delete', name: 'Delete Leads', module: 'CRM' },
    { code: 'deals:view', name: 'View Deals', module: 'CRM' },
    { code: 'deals:create', name: 'Create Deals', module: 'CRM' },
    { code: 'deals:edit', name: 'Edit Deals', module: 'CRM' },

    // CRM - Expanded Granular Permissions
    { code: 'crm:targets:view', name: 'View Targets', module: 'CRM' },
    { code: 'crm:pipeline:view', name: 'View Pipeline', module: 'CRM' },
    { code: 'crm:scheduler:view', name: 'View Scheduler', module: 'CRM' },
    { code: 'crm:activities:view', name: 'View Activities', module: 'CRM' },
    { code: 'crm:contacts:view', name: 'View Contacts', module: 'CRM' },
    { code: 'crm:accounts:view', name: 'View Accounts', module: 'CRM' },
    { code: 'crm:staff', name: 'Access CRM Staff & Workforce', module: 'CRM' },
    { code: 'crm:setup', name: 'Access CRM Advanced & Setup', module: 'CRM' },

    // Inventory
    { code: 'inventory:view', name: 'View Inventory', module: 'Inventory' },
    { code: 'inventory:create', name: 'Create Inventory', module: 'Inventory' },
    { code: 'inventory:edit', name: 'Edit Inventory', module: 'Inventory' },
    { code: 'inventory:delete', name: 'Delete Inventory', module: 'Inventory' },
    { code: 'inventory:admin', name: 'Inventory Administrator', module: 'Inventory' },
    { code: 'inventory:adjustments:view', name: 'View Stock Adjustments', module: 'Inventory' },
    { code: 'inventory:adjustments:create', name: 'Create Stock Adjustments', module: 'Inventory' },

    // Purchasing
    { code: 'purchasing:view', name: 'View Purchase Orders', module: 'Purchasing' },
    { code: 'purchasing:create', name: 'Create Purchase Orders', module: 'Purchasing' },
    { code: 'purchasing:edit', name: 'Edit Purchase Orders', module: 'Purchasing' },
    { code: 'suppliers:view', name: 'View Suppliers', module: 'Purchasing' },
    { code: 'suppliers:create', name: 'Create Suppliers', module: 'Purchasing' },
    { code: 'suppliers:edit', name: 'Edit Suppliers', module: 'Purchasing' },
    { code: 'purchasing:returns:view', name: 'View Purchase Returns', module: 'Purchasing' },
    { code: 'purchasing:returns:create', name: 'Create Purchase Returns', module: 'Purchasing' },

    // HR - Attendance & Employees
    { code: 'hr:view', name: 'View HR', module: 'HR' },
    { code: 'hr:attendance:view', name: 'View Attendance', module: 'HR' },
    { code: 'hr:attendance:create', name: 'Mark Attendance', module: 'HR' },
    { code: 'hr:attendance:edit', name: 'Edit Attendance', module: 'HR' },
    { code: 'hr:employees:view', name: 'View Employees', module: 'HR' },
    { code: 'attendance:view', name: 'View Attendance Records', module: 'HR' },

];

/**
 * Ensures that permission codes exist in the database.
 * If they are part of the standard set, they are automatically created.
 */
async function ensurePermissionsExist(codes: string[]) {
    if (!codes || codes.length === 0) return;

    // Filter out the '*' permission which is a special case
    const realCodes = codes.filter(c => c !== '*');
    if (realCodes.length === 0) return;

    // Check what exists
    const existingPerms = await prisma.permission.findMany({
        where: { code: { in: realCodes } },
        select: { code: true }
    });
    const existingSet = new Set(existingPerms.map(p => p.code));
    const missingCodes = realCodes.filter(c => !existingSet.has(c));

    if (missingCodes.length > 0) {
        // Find them in standard set
        const toCreate = STANDARD_PERMISSIONS.filter(p => missingCodes.includes(p.code));

        if (toCreate.length > 0) {
            await prisma.permission.createMany({
                data: toCreate.map(p => ({
                    code: p.code,
                    name: p.name,
                    category: p.module
                })),
                skipDuplicates: true
            });
        }

        // --- NEW: CATCH-ALL FOR DYNAMIC CODES ---
        // If some codes are still missing (not in STANDARD_PERMISSIONS), create them with generic names
        // This prevents the P2003 Foreign Key crash!
        const finalChecks = await prisma.permission.findMany({ where: { code: { in: missingCodes } }, select: { code: true } });
        const finalSet = new Set(finalChecks.map(p => p.code));
        const absoluteMissing = missingCodes.filter(c => !finalSet.has(c));

        if (absoluteMissing.length > 0) {
            await prisma.permission.createMany({
                data: absoluteMissing.map(c => ({
                    code: c,
                    name: c.split(':').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    category: 'System'
                })),
                skipDuplicates: true
            });
        }
    }
}

/**
 * Seed default roles for the tenant
 * This creates standard RBAC roles with predefined permissions
 */
export async function seedRolesAndPermissions() {
    const session = await auth();

    if (!session?.user?.id) {
        return { error: "Unauthorized: No active session" };
    }

    if (!session.user.tenantId) {
        return { error: "Unauthorized: No tenant ID found in session" };
    }

    try {
        const tenantId = session.user.tenantId;

        // Define standard roles with permissions
        const rolesData = [
            // 1. SUPER ADMIN (System Owner)
            {
                key: 'super_admin',
                name: 'Super Administrator',
                permissions: ['*']
            },
            // 2. ADMINISTRATOR (Hospital Admin)
            {
                key: 'admin',
                name: 'Administrator',
                permissions: [
                    'users:view', 'users:create', 'users:edit', 'users:delete',
                    'roles:view', 'roles:manage',
                    'settings:view', 'settings:edit',
                    'hms:admin', 'crm:admin', 'inventory:admin',
                    'hms:view', 'crm:view', 'inventory:view', 'accounting:view',
                    'crm:staff', 'crm:setup'
                ]
            },
            // 3. DOCTOR (Clinical - Diagnosis & Treatment)
            {
                key: 'doctor',
                name: 'Doctor',
                permissions: [
                    'hms:view',
                    'hms:dashboard:doctor',  // Specific Dashboard
                    'patients:view',         // Needs to see History
                    'appointments:view',     // Needs to see Schedule
                    'prescriptions:view', 'prescriptions:create', 'prescriptions:edit', // Rx
                    'lab:view',              // View Lab Results
                    'vitals:view'            // View Vitals
                ]
            },
            // 4. NURSE (Clinical - Care & Vitals)
            // STRICT: No Patient Registry, No Appointment Scheduling. Focused on Nursing Station.
            {
                key: 'nurse',
                name: 'Nurse',
                permissions: [
                    'hms:view',
                    'hms:dashboard:nurse',   // MAIN WORKSPACE
                    'vitals:view', 'vitals:create', 'vitals:edit', // Vitals Management
                    'prescriptions:view',    // View Rx to Administer (Read Only)
                    'attendance:view'        // View/Mark Attendance
                ]
            },
            // 5. RECEPTIONIST (Front Desk - Reg & Scheduling)
            {
                key: 'receptionist',
                name: 'Receptionist',
                permissions: [
                    'hms:view',
                    'hms:dashboard:reception', // MAIN WORKSPACE
                    'patients:view', 'patients:create', 'patients:edit', // Registry Access
                    'appointments:view', 'appointments:create', 'appointments:edit', // Scheduling
                    'billing:view', 'billing:create' // Basic Cashiering
                ]
            },
            // 6. PHARMACIST (Inventory & Dispensing)
            {
                key: 'pharmacist',
                name: 'Pharmacist',
                permissions: [
                    'hms:view',
                    'pharmacy:view', 'pharmacy:create', 'pharmacy:edit', // Dispensing
                    'inventory:view', 'inventory:adjustments:create',    // Stock Mgmt
                    'prescriptions:view' // View Rx to Dispense
                ]
            },
            // 7. LAB TECHNICIAN (Diagnostics)
            {
                key: 'lab_technician',
                name: 'Lab Technician',
                permissions: [
                    'hms:view',
                    'lab:view', 'lab:create', 'lab:edit', // Lab Orders & Results
                    'patients:view' // Needs to select patient for result entry
                ]
            },
            // 8. ACCOUNTANT (Finance)
            {
                key: 'accountant',
                name: 'Accountant',
                permissions: [
                    'hms:view',
                    'billing:view', 'billing:create', 'billing:edit', 'billing:returns:view',
                    'accounting:view', 'accounting:create',
                    'purchasing:view', 'suppliers:view'
                ]
            }
        ];

        const results = [];
        
        // --- ADDED: PROACTIVE PERMISSION SYNC ---
        // Collect all unique permission codes from all standard roles
        const allPermissionsToEnsure = new Set<string>();
        rolesData.forEach(r => r.permissions.forEach(p => allPermissionsToEnsure.add(p)));
        
        // Sync them to the database to prevent foreign key (FK) violation on role_permission table
        await ensurePermissionsExist(Array.from(allPermissionsToEnsure));
        // ----------------------------------------

        for (const roleData of rolesData) {
            // Check if role exists
            const existing = await prisma.role.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: roleData.key
                }
            });

            if (!existing) {
                // Create role
                const newRole = await prisma.role.create({
                    data: {
                        id: crypto.randomUUID(), // Explicit ID generation
                        tenant_id: tenantId,
                        key: roleData.key,
                        name: roleData.name,
                        permissions: roleData.permissions
                    }
                });

                // Also seed role_permission table
                if (roleData.permissions.length > 0) {
                    await prisma.role_permission.createMany({
                        data: roleData.permissions.map(p => ({
                            role_id: newRole.id,
                            permission_code: p,
                            is_granted: true
                        }))
                    });
                }

                results.push({ action: 'created', role: newRole.name, key: newRole.key });
            } else {
                // OVERWRITE (Force Standard Compliance - "Stress Free")
                // We update permissions to ensure the role matches the definition
                await prisma.role.update({
                    where: { id: existing.id },
                    data: { permissions: roleData.permissions }
                });

                // Sync role_permission table
                await prisma.role_permission.deleteMany({ where: { role_id: existing.id } });
                await prisma.role_permission.createMany({
                    data: roleData.permissions.map(p => ({
                        role_id: existing.id,
                        permission_code: p,
                        is_granted: true
                    }))
                });

                results.push({ action: 'updated', role: existing.name, key: existing.key });
            }
        }

        // Note: revalidatePath removed - this function is called during render
        // and revalidation should happen in user-triggered actions only

        return {
            success: true,
            message: `Successfully processed ${results.length} roles`,
            results
        };

    } catch (error) {
        console.error("Failed to seed roles:", error);
        return {
            error: `Failed to seed roles: ${(error as Error).message}`
        };
    }
}

/**
 * Create a new role
 */
/**
 * Create a new role
 */
export async function createRole(data: { key: string; name: string; permissions: string[] }) {
    const session = await auth();

    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const tenantId = session.user.tenantId;

        // Check if role name already exists for this tenant
        const existing = await prisma.role.findFirst({
            where: {
                tenant_id: tenantId,
                name: data.name
            }
        });

        if (existing) {
            return { error: "A role with this name already exists" };
        }

        // --- ADDED: PROACTIVE PERMISSION SYNC ---
        await ensurePermissionsExist(data.permissions);

        const role = await prisma.role.create({
            data: {
                id: crypto.randomUUID(), // Explicit ID generation
                tenant_id: tenantId,
                key: data.key || data.name.toLowerCase().replace(/\s+/g, '_'),
                name: data.name,
                permissions: data.permissions, // Array-based storage support
            }
        });

        // Also add to role_permission table for granular indexable access
        if (data.permissions.length > 0) {
            await prisma.role_permission.createMany({
                data: data.permissions.map(p => ({
                    role_id: role.id,
                    permission_code: p,
                    is_granted: true
                }))
            });
        }

        revalidatePath('/settings/roles');

        return { success: true, data: role };
    } catch (error) {
        console.error("Failed to create role:", error);
        return { error: `Failed to create role: ${(error as Error).message}` };
    }
}

/**
 * Update an existing role
 */
export async function updateRole(roleId: string, data: { name: string; permissions: string[] }) {
    const session = await auth();

    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const tenantId = session.user.tenantId;

        // Verify the role belongs to this tenant
        const existing = await prisma.role.findFirst({
            where: {
                id: roleId,
                tenant_id: tenantId
            }
        });

        if (!existing) {
            return { error: "Role not found or access denied" };
        }

        // Proactively ensure permissions exist in DB before linking
        await ensurePermissionsExist(data.permissions);

        // Update name and permissions array
        await prisma.role.update({
            where: { id: roleId },
            data: {
                name: data.name,
                permissions: data.permissions
            }
        });

        // Update permissions table: Delete all and re-insert
        await prisma.role_permission.deleteMany({
            where: { role_id: roleId }
        });

        if (data.permissions.length > 0) {
            await prisma.role_permission.createMany({
                data: data.permissions.map(p => ({
                    role_id: roleId,
                    permission_code: p,
                    is_granted: true
                }))
            });
        }

        revalidatePath('/settings/roles');

        return { success: true, data: { ...existing, permissions: data.permissions } };
    } catch (error) {
        console.error("Failed to update role:", error);
        return { error: `Failed to update role: ${(error as Error).message}` };
    }
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: string) {
    const session = await auth();

    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const tenantId = session.user.tenantId;

        // Verify the role belongs to this tenant
        const existing = await prisma.role.findFirst({
            where: {
                id: roleId,
                tenant_id: tenantId
            }
        });

        if (!existing) {
            return { error: "Role not found or access denied" };
        }

        // Check assigned users in user_role
        const usersWithRole = await prisma.user_role.count({
            where: { role_id: roleId }
        });

        if (usersWithRole > 0) {
            return { error: `Cannot delete role. ${usersWithRole} user(s) are assigned this role.` };
        }

        // Cascade delete permissions 
        await prisma.role_permission.deleteMany({ where: { role_id: roleId } });

        await prisma.role.delete({
            where: { id: roleId }
        });

        revalidatePath('/settings/roles');

        return { success: true, message: "Role deleted successfully" };
    } catch (error) {
        console.error("Failed to delete role:", error);
        return { error: `Failed to delete role: ${(error as Error).message}` };
    }
}

/**
 * Get all roles for the current tenant
 */
export async function getRoles() {
    const session = await auth();

    if (!session?.user?.id || !session.user.tenantId) {
        return { error: "Unauthorized" };
    }

    try {
        const roles = await prisma.role.findMany({
            where: {
                tenant_id: session.user.tenantId
            },
            select: {
                id: true,
                name: true,

            },
            orderBy: {
                name: 'asc'
            }
        });

        return { data: roles };
    } catch (error) {
        console.error("Error fetching roles:", error);
        return { error: "Failed to fetch roles" };
    }
}

/**
 * Get all permissions (Combined DB + Standard Defaults)
 */
export async function getAllPermissions() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        // Fetch Dynamic Permissions from DB
        const dbPermissions = await prisma.permission.findMany();

        // Ensure all STANDARD_PERMISSIONS exist in DB
        const dbCodeSet = new Set(dbPermissions.map(p => p.code));
        const missing = STANDARD_PERMISSIONS.filter(p => !dbCodeSet.has(p.code));

        if (missing.length > 0) {
            try {
                // Ensure they exist in DB so FK constraints are happy
                await prisma.permission.createMany({
                    data: missing.map(p => ({
                        code: p.code,
                        name: p.name,
                        category: p.module
                    })),
                    skipDuplicates: true
                });
                console.log(`Synced ${missing.length} new standard permissions to DB.`);
            } catch (syncErr) {
                console.error("Critical: Failed to sync standard permissions to DB", syncErr);
            }
        }

        // Merge: Standard takes precedence
        const combined = [...STANDARD_PERMISSIONS];

        // Add DB perms if not already in standard
        const codeSet = new Set(STANDARD_PERMISSIONS.map(p => p.code));

        dbPermissions.forEach(p => {
            if (!codeSet.has(p.code)) {
                let mod = p.category || 'Custom';

                // Normalization Logic
                if (mod.toLowerCase() === 'crm') mod = 'CRM';
                else if (mod.toLowerCase() === 'hms') mod = 'HMS';
                else if (mod.toLowerCase() === 'finance') mod = 'Finance';
                else if (mod.toLowerCase() === 'inventory') mod = 'Inventory';
                else if (mod.toLowerCase() === 'purchasing') mod = 'Purchasing';

                combined.push({
                    code: p.code,
                    name: p.name,
                    module: mod
                });
            }
        });

        // FILTER BY TENANT SUBSCRIPTION
        if (session.user.tenantId) {
            const tenantModules = await prisma.tenant_module.findMany({
                where: { tenant_id: session.user.tenantId, enabled: true },
                select: { module_key: true }
            });

            const allowedKeys = new Set(tenantModules.map(tm => tm.module_key.toLowerCase()));
            // Always allow System
            allowedKeys.add('system');

            // Filter combined list
            const filtered = combined.filter(p => {
                const modKey = p.module.toLowerCase();
                // Special Mapping: 'HMS' permissions usually map to 'hms' key, etc.
                // If the module is 'Custom', allow it? Or check if it matches any key.
                if (modKey === 'system') return true;
                if (modKey === 'custom') return true;

                // Check against subscribed keys
                // Note: STANDARD_PERMISSIONS uses 'HMS', 'CRM' (uppercase). allowedKeys has 'hms', 'crm' (lowercase).
                return allowedKeys.has(modKey);
            });

            return { success: true, data: filtered };
        }

        return { success: true, data: combined };
    } catch (error) {
        console.error("Failed to fetch permissions:", error);
        return { error: "Failed to fetch permissions" };
    }
}

/**
 * Get ALL Permissions for a specific User (Flattened)
 * Merges: Table-based Role Permissions And Array-based Role Permissions
 * Returns an array of strings for serializability in Server Actions
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
    try {
        const session = await auth();
        // Use user's tenant from session for context isolation
        const tenantId = session?.user?.tenantId;

        if (!tenantId) return [];

        const permissionSet = new Set<string>();

        const userRoles = await prisma.user_role.findMany({
            where: { user_id: userId, tenant_id: tenantId }
        });
        const roleIds = userRoles.map(ur => ur.role_id);

        // 1.5. HYBRID SUPPORT: Check for Legacy String Role in app_user
        // Many users have 'role' column set (e.g. 'receptionist') but no entry in user_role table.
        // We must bridge this gap to allow permissions to load.
        const userRecord = await prisma.app_user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (userRecord?.role) {
            // Find the role entity that matches this string key
            const legacyRole = await prisma.role.findFirst({
                where: {
                    tenant_id: tenantId,
                    key: userRecord.role.toLowerCase() // Normalization
                }
            });
            if (legacyRole) {
                roleIds.push(legacyRole.id);
            }
        }

        if (roleIds.length > 0) {
            // 2. Fetch Roles (for array-based permissions)
            const roles = await prisma.role.findMany({
                where: { id: { in: roleIds } }
            });
            roles.forEach(r => {
                if (Array.isArray(r.permissions)) {
                    r.permissions.forEach((p: string) => permissionSet.add(p));
                }
            });
            // 3. Fetch Role-Permission Mappings (for table-based permissions)
            const rolePermissions = await prisma.role_permission.findMany({
                where: { role_id: { in: roleIds }, is_granted: true }
            });
            rolePermissions.forEach(rp => permissionSet.add(rp.permission_code));
        }

        // 4. Check for User-Specific Permissions override
        const userPermissions = await prisma.user_permission.findMany({
            where: { user_id: userId, tenant_id: tenantId, is_granted: true }
        });
        userPermissions.forEach(up => permissionSet.add(up.permission_code));

        // 5. Implicitly Grant Super Admin (Wildcard) if session says isAdmin
        if (session?.user?.isAdmin) {
            permissionSet.add('*');
        }

        // Return as array for serializability
        return Array.from(permissionSet);
    } catch (error) {
        console.error("Error fetching user permissions:", error);
        return [];
    }
}

/**
 * Check if current user has a specific permission
 */
export async function checkPermission(permissionCode: string): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;

    // Super Admin Bypass (optional)
    // if (session.user.isAdmin) return true; 

    const perms = await getUserPermissions(session.user.id);

    if (perms.includes('*')) return true;
    if (perms.includes(permissionCode)) return true;

    return false;
}
