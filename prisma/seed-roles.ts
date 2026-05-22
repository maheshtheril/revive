
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

// World Standard Modular Role Definitions
const ROLES_DEFINITION = [
    // --- HMS MODULE ---
    {
        name: 'Super Admin',
        module: 'system',
        description: 'Complete access to all system features and settings',
        permissions: ['*']
    },
    {
        name: 'Hospital Admin',
        module: 'hms',
        description: 'Manage hospital operations, users, and administrative settings',
        permissions: [
            'dashboard.view', 'user.manage', 'settings.manage', 'hms.admin',
            'hms.reception.view', 'hms.patient.view', 'hms.appointment.view', 'hms.clinical.view', 'hms.hr.view', 'hms.billing.view', 'hms.ward.view'
        ]
    },
    {
        name: 'Doctor',
        module: 'hms',
        description: 'Clinical staff with access to patient records and prescriptions',
        permissions: [
            'hms.clinical.view', 'hms.clinical.create', 'hms.appointment.view', 'hms.patient.view'
        ]
    },
    {
        name: 'Nurse',
        module: 'hms',
        description: 'Nursing staff for triage, vitals, and patient care',
        permissions: [
            'hms.triage.view', 'hms.triage.create', 'hms.vitals.create', 'hms.nursing.consume'
        ]
    },
    {
        name: 'Receptionist',
        module: 'hms',
        description: 'Front desk staff for patient check-in and appointments',
        permissions: [
            'hms:dashboard:reception', 'hms:view'
        ]
    },

    // --- CRM MODULE ---
    {
        name: 'Sales Manager',
        module: 'crm',
        description: 'Manage sales teams, pipelines, and targets',
        permissions: [
            'crm.dashboard.view', 'crm.leads.manage', 'crm.reports.view', 'crm.settings.manage'
        ]
    },
    {
        name: 'Sales Representative',
        module: 'crm',
        description: 'Manage leads, deals, and daily sales activities',
        permissions: [
            'crm.leads.view', 'crm.leads.create', 'crm.deals.create', 'crm.activities.view'
        ]
    },
    {
        name: 'Support Agent',
        module: 'crm',
        description: 'Handle customer tickets and potential upsells',
        permissions: [
            'crm.contacts.view', 'crm.tickets.manage'
        ]
    },

    // --- ACCOUNTS MODULE ---
    {
        name: 'Finance Manager',
        module: 'accounts',
        description: 'Oversee general ledger, taxes, and financial reporting',
        permissions: [
            'accounts.dashboard.view', 'accounts.ledger.view', 'accounts.tax.manage', 'accounts.reports.financial'
        ]
    },
    {
        name: 'Accountant',
        module: 'accounts',
        description: 'Process daily journals, invoices, and payments',
        permissions: [
            'accounts.journal.create', 'accounts.invoice.view', 'accounts.payment.process'
        ]
    },
    {
        name: 'Auditor',
        module: 'accounts',
        description: 'Read-only access to financial records for auditing',
        permissions: [
            'accounts.ledger.view', 'accounts.reports.view'
        ]
    },

    // --- INVENTORY MODULE ---
    {
        name: 'Inventory Manager',
        module: 'inventory',
        description: 'Manage stock levels, warehouses, and procurement',
        permissions: [
            'inventory.dashboard.view', 'inventory.stock.adjust', 'inventory.po.approve'
        ]
    },
    {
        name: 'Store Keeper',
        module: 'inventory',
        description: 'Receive goods, pack orders, and manage stock movement',
        permissions: [
            'inventory.stock.view', 'inventory.grn.create', 'inventory.do.create'
        ]
    }
];

async function main() {
    console.log('🚀 Seeding World Standard Modular Roles...');

    const distinctTenants = await prisma.app_user.findMany({
        distinct: ['tenant_id'],
        select: { tenant_id: true }
    });

    if (distinctTenants.length === 0) {
        console.warn('⚠️ No tenants found. Seeding aborted.');
        return;
    }

    console.log(`Found ${distinctTenants.length} tenants. Applying modular roles...`);

    for (const { tenant_id } of distinctTenants) {
        console.log(`\n🏢 Processing Tenant: ${tenant_id}`);

        for (const roleDef of ROLES_DEFINITION) {
            // Upsert Role with Module
            const existingRole = await prisma.hms_role.findFirst({
                where: {
                    tenant_id: tenant_id,
                    name: roleDef.name
                }
            });

            let roleId = existingRole?.id;

            if (existingRole) {
                console.log(`  - Updating role: ${roleDef.name} [${roleDef.module.toUpperCase()}]`);
                // @ts-ignore - 'module' might not be in generated types yet if just pushed
                await prisma.hms_role.update({
                    where: { id: existingRole.id },
                    data: {
                        description: roleDef.description,
                        module: roleDef.module
                    }
                });
            } else {
                console.log(`  - Creating role: ${roleDef.name} [${roleDef.module.toUpperCase()}]`);
                // @ts-ignore
                const newRole = await prisma.hms_role.create({
                    data: {
                        tenant_id: tenant_id,
                        name: roleDef.name,
                        description: roleDef.description,
                        module: roleDef.module
                    }
                });
                roleId = newRole.id;
            }

            if (!roleId) continue;

            // Upsert Permissions
            await prisma.hms_role_permissions.deleteMany({ where: { role_id: roleId } });

            if (roleDef.permissions.length > 0) {
                await prisma.hms_role_permissions.createMany({
                    data: roleDef.permissions.map(perm => ({
                        role_id: roleId!,
                        permission: perm
                    }))
                });
            }
        }
    }

    console.log('\n✅ Modular Roles Seeding Completed!');
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
