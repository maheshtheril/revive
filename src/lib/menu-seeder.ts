
import { prisma } from "@/lib/prisma"

export async function ensureAccountingMenu() {
    try {
        // --- ADMIN CONFIG NOW HANDLED IN ensureAdminMenus ---

        // 2.5 Ensure 'Dashboard' exists in Accounting Module
        const dashKey = 'acc-dashboard';
        const existingDash = await prisma.menu_items.findFirst({ where: { key: dashKey } });
        if (!existingDash) {
            await prisma.menu_items.create({
                data: {
                    label: 'Gateway of Tally',
                    url: '/hms/accounting',
                    key: dashKey,
                    module_key: 'finance',
                    icon: 'LayoutDashboard',
                    sort_order: 1, // First item
                    is_global: true
                }
            });
            console.log("Seeded Tally Dashboard menu item.");
        } else if (existingDash.url !== '/hms/accounting' || existingDash.label !== 'Gateway of Tally') {
            await prisma.menu_items.update({
                where: { id: existingDash.id },
                data: { url: '/hms/accounting', label: 'Gateway of Tally', module_key: 'finance' }
            });
        }

        // 3. SEED JOURNALS MENU (Enterprise Feature)
        await ensureJournalMenu();


        // D. Ensure 'Customers' and 'Vendors' Groups exist with Receipts/Payments
        await ensurePaymentMenus();

    } catch (e) {
        console.error("Failed to auto-seed menu:", e);
    }
}

async function ensurePaymentMenus() {
    // Customers -> Receipts
    let custParent = await prisma.menu_items.findFirst({ where: { key: 'acc-customers' } });
    if (!custParent) {
        custParent = await prisma.menu_items.create({
            data: { label: 'Customers', url: '#', key: 'acc-customers', module_key: 'finance', icon: 'Users', sort_order: 10, is_global: true }
        });
    }

    const receiptMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-receipts' } });
    if (!receiptMenu) {
        await prisma.menu_items.create({
            data: { label: 'Receipt Vouchers', url: '/hms/accounting/receipts', key: 'acc-receipts', module_key: 'finance', icon: 'ArrowDownLeft', parent_id: custParent.id, sort_order: 20, is_global: true }
        });
    } else if (receiptMenu.url !== '/hms/accounting/receipts') {
        await prisma.menu_items.update({ where: { id: receiptMenu.id }, data: { url: '/hms/accounting/receipts', label: 'Receipt Vouchers' } });
    }

    // Vendors -> Payments
    let vendParent = await prisma.menu_items.findFirst({ where: { key: 'acc-vendors' } });
    if (!vendParent) {
        vendParent = await prisma.menu_items.create({
            data: { label: 'Vendors', url: '#', key: 'acc-vendors', module_key: 'finance', icon: 'Truck', sort_order: 20, is_global: true }
        });
    }

    const paymentMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-payments' } });
    if (!paymentMenu) {
        await prisma.menu_items.create({
            data: { label: 'Payment Vouchers', url: '/hms/accounting/payments', key: 'acc-payments', module_key: 'finance', icon: 'ArrowUpRight', parent_id: vendParent.id, sort_order: 20, permission_code: 'billing:view', is_global: true }
        });
    } else if (paymentMenu.url !== '/hms/accounting/payments') {
        await prisma.menu_items.update({ where: { id: paymentMenu.id }, data: { url: '/hms/accounting/payments', label: 'Payment Vouchers' } });
    }

    // BULK SAFETY: Lock ALL Accounting Menus if they don't have permissions
    // This catches 'acc-vendors' (created above) and any others missed.
    await prisma.menu_items.updateMany({
        where: {
            module_key: 'finance',
            permission_code: null
        },
        data: { permission_code: 'billing:view' }
    });
}


async function ensureJournalMenu() {
    try {
        // A. Ensure 'General Ledger' Parent Exists
        let ledgerParent = await prisma.menu_items.findFirst({
            where: { key: 'acc-ledger' }
        });

        if (!ledgerParent) {
            console.log("Creating General Ledger parent menu...");
            ledgerParent = await prisma.menu_items.create({
                data: {
                    label: 'General Ledger',
                    url: '#',
                    key: 'acc-ledger',
                    module_key: 'finance',
                    icon: 'Book',
                    sort_order: 30, // Positioned after Sales/Purchases
                    permission_code: 'billing:view',
                    is_global: true
                }
            });
        } else if (!ledgerParent.permission_code) {
            await prisma.menu_items.update({ where: { id: ledgerParent.id }, data: { permission_code: 'billing:view' } });
        }

        // B. Ensure 'Journal Entries' Child Exists
        const journalsMenu = await prisma.menu_items.findFirst({
            where: { key: 'acc-journals' }
        });

        if (!journalsMenu) {
            console.log("Creating Journal Entries menu...");
            await prisma.menu_items.create({
                data: {
                    label: 'Journal Register',
                    url: '/hms/accounting/journals',
                    key: 'acc-journals',
                    module_key: 'finance',
                    icon: 'BookOpen',
                    parent_id: ledgerParent.id,
                    sort_order: 10,
                    permission_code: 'billing:view',
                    is_global: true
                }
            });
        } else if (journalsMenu.url !== '/hms/accounting/journals') {
            await prisma.menu_items.update({ where: { id: journalsMenu.id }, data: { url: '/hms/accounting/journals', label: 'Journal Register', permission_code: 'billing:view' } });
        }

        // C. Ensure 'Chart of Accounts' Child Exists
        const coaMenu = await prisma.menu_items.findFirst({
            where: { key: 'acc-coa' }
        });

        if (!coaMenu) {
            console.log("Creating Chart of Accounts menu...");
            await prisma.menu_items.create({
                data: {
                    label: 'Chart of Accounts',
                    url: '/hms/accounting/coa',
                    key: 'acc-coa',
                    module_key: 'finance',
                    icon: 'ListTree',
                    parent_id: ledgerParent.id,
                    sort_order: 5, // Before Journals
                    permission_code: 'billing:view',
                    is_global: true
                }
            });
        } else if (coaMenu.url !== '/hms/accounting/coa') {
            await prisma.menu_items.update({ where: { id: coaMenu.id }, data: { url: '/hms/accounting/coa', permission_code: 'billing:view' } });
        }
    } catch (error) {
        console.error("Failed to seed journal menus:", error);
    }
}

export async function ensureAdminMenus() {
    try {
        const adminItems = [
            { key: 'users', label: 'Users', url: '/settings/users', icon: 'Users', sort: 90, permission: 'users:view' },
            { key: 'roles', label: 'Roles & Permissions', url: '/settings/roles', icon: 'Shield', url_key: 'settings-roles', sort: 91, permission: 'roles:manage' }, // Added unique key
            { key: 'general-settings', label: 'Global Settings', url: '/settings/global', icon: 'Settings', sort: 99, permission: 'settings:view' },
            { key: 'branch-settings', label: 'Branch Management', url: '/settings/branches', icon: 'Building2', sort: 98, permission: 'settings:view' },
            { key: 'geography-settings', label: 'Geography & Regions', url: '/settings/geography', icon: 'Globe', sort: 96, permission: 'settings:view' },
            { key: 'holiday-settings', label: 'Holiday Masters', url: '/settings/holidays', icon: 'CalendarDays', sort: 97, permission: 'settings:view' },
            { key: 'hms-settings', label: 'HMS Settings', url: '/settings/hms', icon: 'Activity', sort: 95, permission: 'hms:admin' },
            { key: 'accounting-settings', label: 'Accounting Config', url: '/settings/accounting', icon: 'Calculator', sort: 94, permission: 'billing:view' },
        ];

        for (const item of adminItems) {
            try {
                const existing = await prisma.menu_items.findFirst({
                    where: { key: item.key }
                });

                if (!existing) {
                    await prisma.menu_items.create({
                        data: {
                            label: item.label,
                            url: item.url,
                            key: item.key,
                            module_key: 'configuration',
                            icon: item.icon,
                            sort_order: item.sort,
                            permission_code: item.permission,
                            is_global: true,
                            parent_id: null // Explicitly handle parent_id
                        }
                    });
                    console.log(`Auto-seeded Admin Menu: ${item.label}`);
                } else {
                    // Update permission if missing
                    if (!existing.permission_code || existing.module_key !== 'configuration') {
                        await prisma.menu_items.update({
                            where: { id: existing.id },
                            data: {
                                module_key: 'configuration',
                                permission_code: item.permission
                            }
                        });
                    }
                }
            } catch (innerError: any) {
                console.error(`Failed to seed admin menu item ${item.label} (Prisma):`, innerError?.message);

                // Fallback: Raw SQL Insert
                try {
                    const rawId = crypto.randomUUID();
                    // Use a raw query to bypass potential Prisma schema mismatch
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO "menu_items" 
                        ("id", "label", "url", "key", "module_key", "icon", "sort_order", "permission_code", "is_global", "parent_id", "created_at", "updated_at")
                        VALUES 
                        ($1::uuid, $2, $3, $4, 'configuration', $5, $6, $7, true, NULL, NOW(), NOW())
                    `, rawId, item.label, item.url, item.key, item.icon, item.sort, item.permission);

                    console.log(`Auto-seeded Admin Menu via Raw SQL: ${item.label}`);
                } catch (rawError: any) {
                    console.error(`Failed to seed admin menu item ${item.label} via Raw SQL:`, rawError?.message);
                }
                // Continue to next item
            }
        }
    } catch (e) {
        console.error("Failed to seed admin menus:", e);
    }
}

export async function ensureCrmMenus() {
    try {
        const items = [
            { key: 'crm-intelligence', label: 'Intelligence', url: '/crm/intelligence', icon: 'Brain', sort: 5 },
            { key: 'crm-dashboard', label: 'CRM Dashboard', url: '/crm/dashboard', icon: 'LayoutDashboard', sort: 10 },
            { key: 'crm-leads', label: 'Leads', url: '/crm/leads', icon: 'Users', sort: 20 },
            { key: 'crm-deals', label: 'Deals Pipeline', url: '/crm/deals', icon: 'DollarSign', sort: 30 },
            { key: 'crm-targets', label: 'Targets', url: '/crm/targets', icon: 'Target', sort: 50 },
            { key: 'crm-activities', label: 'Activities', url: '/crm/activities', icon: 'PhoneCall', sort: 60 },
            // Staff & HR (Nested)
            { key: 'crm-staff-root', label: 'Staff & Workforce', url: '#', icon: 'Briefcase', sort: 80 },
            // CRM Setup (Nested)
            { key: 'crm-setup-root', label: 'Advanced & Setup', url: '#', icon: 'Settings', sort: 90 },
        ];

        // --- HELPER FOR RAW SQL INSERT ---
        const rawInsert = async (data: any) => {
            const rawId = crypto.randomUUID();
            const parentId = data.parent_id || null;
            // Safe param handling for optional fields
            const perm = data.permission_code || null;

            await prisma.$executeRawUnsafe(`
                INSERT INTO "menu_items" 
                ("id", "label", "url", "key", "module_key", "icon", "sort_order", "permission_code", "is_global", "parent_id", "created_at", "updated_at")
                VALUES 
                ($1::uuid, $2, $3, $4, $5, $6, $7, $8, true, $9::uuid, NOW(), NOW())
            `, rawId, data.label, data.url, data.key, data.module_key, data.icon, data.sort_order, perm, parentId);
            return { id: rawId };
        };

        // 2a. Staff & HR Root
        let staffParent: any = await prisma.menu_items.findFirst({ where: { key: 'crm-staff-root' } });
        if (!staffParent) {
            try {
                staffParent = await prisma.menu_items.create({
                    data: { label: 'Staff & Workforce', url: '#', key: 'crm-staff-root', module_key: 'crm', icon: 'Briefcase', sort_order: 80, is_global: true, permission_code: 'crm:staff', parent_id: null }
                });
            } catch (e: any) {
                console.error("Failed to create Staff Root (Prisma):", e?.message);
                try {
                    const res = await rawInsert({ label: 'Staff & Workforce', url: '#', key: 'crm-staff-root', module_key: 'crm', icon: 'Briefcase', sort_order: 80, permission_code: 'crm:staff', parent_id: null });
                    staffParent = { id: res.id }; // Mock object for children
                    console.log("Created Staff Root via Raw SQL");
                } catch (rawE: any) { console.error("Failed to create Staff Root (Raw):", rawE?.message); }
            }
        } else if (staffParent.permission_code !== 'crm:staff') {
            await prisma.menu_items.update({
                where: { id: staffParent.id },
                data: { permission_code: 'crm:staff' }
            });
        }

        const staffItems = [
            { key: 'crm-employees', label: 'Employee Directory', url: '/crm/employees', icon: 'Users', sort: 10, permission: 'hr:view' },
            { key: 'crm-departments', label: 'Departments', url: '/crm/departments', icon: 'Network', sort: 15, permission: 'hr:view' },
            { key: 'crm-org-chart', label: 'Org Chart', url: '/crm/org-chart', icon: 'GitGraph', sort: 16, permission: 'hr:view' },
            { key: 'crm-designations', label: 'Designations', url: '/settings/designations', icon: 'UserCheck', sort: 20, permission: 'roles:manage' },
        ];

        if (staffParent) {
            for (const item of staffItems) {
                try {
                    const existing = await prisma.menu_items.findFirst({ where: { key: item.key } });
                    if (!existing) {
                        await prisma.menu_items.create({
                            data: {
                                label: item.label, url: item.url, key: item.key, module_key: 'crm', icon: item.icon,
                                parent_id: staffParent.id, sort_order: item.sort, permission_code: item.permission, is_global: true
                            }
                        });
                    } else {
                        await prisma.menu_items.update({
                            where: { id: existing.id },
                            data: { module_key: 'crm', parent_id: staffParent.id, permission_code: item.permission }
                        });
                    }
                } catch (e: any) {
                    console.error(`Failed to seed ${item.label} (Prisma):`, e?.message);
                    try {
                        await rawInsert({
                            label: item.label, url: item.url, key: item.key, module_key: 'crm', icon: item.icon,
                            parent_id: staffParent.id, sort_order: item.sort, permission_code: item.permission
                        });
                        console.log(`Created ${item.label} via Raw SQL`);
                    } catch (rawE: any) { console.error(`Failed to seed ${item.label} (Raw):`, rawE?.message); }
                }
            }
        }

        // 2b. Advanced Setup Root
        let setupParent: any = await prisma.menu_items.findFirst({ where: { key: 'crm-setup-root' } });
        if (!setupParent) {
            try {
                setupParent = await prisma.menu_items.create({
                    data: { label: 'Advanced & Setup', url: '#', key: 'crm-setup-root', module_key: 'crm', icon: 'Settings', sort_order: 90, is_global: true, permission_code: 'crm:setup', parent_id: null }
                });
            } catch (e: any) {
                console.error("Failed to create Setup Root (Prisma):", e?.message);
                try {
                    const res = await rawInsert({ label: 'Advanced & Setup', url: '#', key: 'crm-setup-root', module_key: 'crm', icon: 'Settings', sort_order: 90, permission_code: 'crm:setup', parent_id: null });
                    setupParent = { id: res.id };
                    console.log("Created Setup Root via Raw SQL");
                } catch (rawE: any) { console.error("Failed to create Setup Root (Raw):", rawE?.message); }
            }
        } else if (setupParent.permission_code !== 'crm:setup') {
            await prisma.menu_items.update({
                where: { id: setupParent.id },
                data: { permission_code: 'crm:setup' }
            });
        }

        const setupItems = [
            { key: 'crm-masters', label: 'CRM Masters', url: '/settings/crm', icon: 'Database', sort: 10, permission: 'crm:admin' },
            { key: 'import-leads', label: 'Leads Import', url: '/crm/import/leads', icon: 'UploadCloud', sort: 20, permission: 'crm:create_leads' },
            { key: 'custom-fields', label: 'Custom Fields', url: '/settings/custom-fields', icon: 'FileText', sort: 30, permission: 'settings:view' },
        ];

        if (setupParent) {
            for (const item of setupItems) {
                try {
                    const existing = await prisma.menu_items.findFirst({ where: { key: item.key } });
                    if (!existing) {
                        await prisma.menu_items.create({
                            data: {
                                label: item.label, url: item.url, key: item.key, module_key: 'crm', icon: item.icon,
                                parent_id: setupParent.id, sort_order: item.sort, permission_code: item.permission, is_global: true
                            }
                        });
                    } else {
                        await prisma.menu_items.update({
                            where: { id: existing.id },
                            data: { module_key: 'crm', parent_id: setupParent.id, permission_code: item.permission }
                        });
                    }
                } catch (e: any) {
                    console.error(`Failed to seed ${item.label} (Prisma):`, e?.message);
                    try {
                        await rawInsert({
                            label: item.label, url: item.url, key: item.key, module_key: 'crm', icon: item.icon,
                            parent_id: setupParent.id, sort_order: item.sort, permission_code: item.permission
                        });
                        console.log(`Created ${item.label} via Raw SQL`);
                    } catch (rawE: any) { console.error(`Failed to seed ${item.label} (Raw):`, rawE?.message); }
                }
            }
        }

        for (const item of items) {
            try {
                const existing = await prisma.menu_items.findFirst({
                    where: { key: item.key }
                });

                if (!existing) {
                    await prisma.menu_items.create({
                        data: {
                            label: item.label,
                            url: item.url,
                            key: item.key,
                            module_key: 'crm',
                            icon: item.icon,
                            sort_order: item.sort,
                            is_global: true,
                            parent_id: null
                        }
                    });
                    console.log(`Auto-seeded CRM Menu: ${item.label}`);
                } else {
                    // Ensure it is in CRM module and correct URL
                    if (existing.module_key !== 'crm' || existing.url !== item.url || existing.label !== item.label) {
                        await prisma.menu_items.update({
                            where: { id: existing.id },
                            data: {
                                module_key: 'crm',
                                url: item.url,
                                label: item.label,
                                parent_id: null // Ensure top level
                            }
                        });
                    }
                }
            } catch (innerError: any) {
                console.error(`Failed to seed CRM menu item ${item.label} (Prisma):`, innerError?.message);

                // Fallback: Raw SQL Insert
                try {
                    const rawId = crypto.randomUUID();
                    await prisma.$executeRawUnsafe(`
                       INSERT INTO "menu_items" 
                       ("id", "label", "url", "key", "module_key", "icon", "sort_order", "permission_code", "is_global", "parent_id", "created_at", "updated_at")
                       VALUES 
                       ($1::uuid, $2, $3, $4, 'crm', $5, $6, NULL, true, NULL, NOW(), NOW())
                   `, rawId, item.label, item.url, item.key, item.icon, item.sort);

                    console.log(`Auto-seeded CRM Menu via Raw SQL: ${item.label}`);
                } catch (rawError: any) {
                    console.error(`Failed to seed CRM menu item ${item.label} via Raw SQL:`, rawError?.message);
                }
            }
        }

        // Cleanup Redundant
        await prisma.menu_items.deleteMany({ where: { key: 'crm-pipeline' } });

    } catch (e) {
        console.error("Failed to seed CRM menus:", e);
    }
}

export async function ensureHmsMenus() {
    try {
        const hmsItems = [
            { key: 'hms-dashboard', label: 'HMS Dashboard', url: '/hms/dashboard', icon: 'LayoutDashboard', sort: 10, permission: 'hms:admin' },
            { key: 'hms-analytics', label: 'Analytics & Trends', url: '/hms/analytics', icon: 'BarChart3', sort: 11, permission: 'hms:admin' },
            { key: 'hms-reception', label: 'Reception', url: '/hms/reception/dashboard', icon: 'MonitorCheck', sort: 12, permission: 'hms:dashboard:reception' },
            { key: 'hms-patients', label: 'Patients', url: '/hms/patients', icon: 'UserCircle', sort: 20, permission: 'patients:view' },
            { key: 'hms-appointments', label: 'Appointments', url: '/hms/appointments', icon: 'Calendar', sort: 30, permission: 'appointments:view' },
            { key: 'hms-doctors', label: 'Doctors', url: '/hms/doctors', icon: 'Stethoscope', sort: 40, permission: 'hms:admin' },
            { key: 'hms-doctor-dash', label: 'Doctor Dashboard', url: '/hms/doctor/dashboard', icon: 'AppWindow', sort: 41, permission: 'hms:dashboard:doctor' },
            { key: 'hms-nursing', label: 'Nursing Station', url: '/hms/nursing/dashboard', icon: 'Activity', sort: 45, permission: 'hms:dashboard:nurse' },
            { key: 'hms-lab', label: 'Laboratory', url: '/hms/lab/dashboard', icon: 'FlaskConical', sort: 46, permission: 'lab:view' },
            { key: 'hms-attendance', label: 'Attendance', url: '/hms/attendance', icon: 'Clock', sort: 50, permission: 'hms:admin' },
            { key: 'hms-roster', label: 'Staff Roster', url: '/hms/attendance/roster', icon: 'Layers', sort: 51, permission: 'hms:admin' },
            { key: 'hms-attendance-logs', label: 'Daily Logs', url: '/hms/attendance/logs', icon: 'ListChecks', sort: 52, permission: 'hms:admin' },
            { key: 'hms-attendance-analytics', label: 'Staff Analytics', url: '/hms/attendance/analytics', icon: 'BarChart3', sort: 53, permission: 'hms:admin' },
            { key: 'hms-billing', label: 'Billing', url: '/hms/billing', icon: 'Receipt', sort: 60, permission: 'billing:view' },
            { key: 'hms-pharmacy-billing', label: 'Pharmacy Billing', url: '/hms/pharmacy/billing', icon: 'Pill', sort: 61, permission: 'billing:view' },
            // { key: 'hms-inventory', label: 'Pharmacy/Inventory', url: '/hms/inventory', icon: 'Package', sort: 70 }, // Removed to allow migration to Inventory Module
            { key: 'hms-wards', label: 'Clinics/Wards', url: '/hms/wards', icon: 'LayoutGrid', sort: 80, permission: 'hms:admin' },
        ];

        // --- HELPER FOR RAW SQL INSERT (Duplicate for scope) ---
        // Note: Ideally extract this to a shared helper file, but keeping localized for now to avoid large refactors.
        const rawInsertHms = async (data: any) => {
            const rawId = crypto.randomUUID();
            const parentId = data.parent_id || null;
            const perm = data.permission_code || null;

            await prisma.$executeRawUnsafe(`
                INSERT INTO "menu_items" 
                ("id", "label", "url", "key", "module_key", "icon", "sort_order", "permission_code", "is_global", "parent_id", "created_at", "updated_at")
                VALUES 
                ($1::uuid, $2, $3, $4, $5, $6, $7, $8, true, $9::uuid, NOW(), NOW())
            `, rawId, data.label, data.url, data.key, data.module_key, data.icon, data.sort_order, perm, parentId);
            return { id: rawId };
        };

        for (const item of hmsItems) {
            try {
                const existing = await prisma.menu_items.findFirst({
                    where: { key: item.key }
                });

                if (!existing) {
                    await prisma.menu_items.create({
                        data: {
                            label: item.label,
                            url: item.url,
                            key: item.key,
                            module_key: 'hms',
                            icon: item.icon,
                            sort_order: item.sort,
                            permission_code: item.permission,
                            is_global: true,
                            parent_id: null
                        }
                    });
                    console.log(`Auto-seeded HMS Menu: ${item.label}`);
                } else {
                    // Always update permission_code to ensure security
                    if (existing.permission_code !== item.permission || existing.url !== item.url) {
                        await prisma.menu_items.update({
                            where: { id: existing.id },
                            data: {
                                url: item.url,
                                permission_code: item.permission
                            }
                        });
                    }
                }
            } catch (innerError: any) {
                console.error(`Failed to seed HMS menu item ${item.label} (Prisma):`, innerError?.message);
                // Fallback: Raw SQL Insert
                try {
                    await rawInsertHms({
                        label: item.label, url: item.url, key: item.key, module_key: 'hms', icon: item.icon,
                        sort_order: item.sort, permission_code: item.permission, parent_id: null
                    });
                    console.log(`Auto-seeded HMS Menu via Raw SQL: ${item.label}`);
                } catch (rawError: any) {
                    console.error(`Failed to seed HMS menu item ${item.label} via Raw SQL:`, rawError?.message);
                }
            }
        }
    } catch (e) {
        console.error("Failed to seed HMS menus:", e);
    }
}

export async function ensurePurchasingMenus() {
    try {
        // 1. Ensure 'Procurement' Parent Exists
        let procParent = await prisma.menu_items.findFirst({ where: { key: 'inv-procurement' } });

        if (!procParent) {
            const inventoryModule = await prisma.menu_items.findFirst({ where: { key: 'hms-inventory' } });
            // Fallback to separate group if no inventory parent found easily, or create top level
            procParent = await prisma.menu_items.create({
                data: { label: 'Procurement', url: '#', key: 'inv-procurement', module_key: 'inventory', icon: 'ShoppingCart', sort_order: 15, permission_code: 'purchasing:view', is_global: true }
            });
        } else if (!procParent.permission_code) {
            await prisma.menu_items.update({ where: { id: procParent.id }, data: { permission_code: 'purchasing:view' } });
        }

        const items = [
            { key: 'inv-suppliers', label: 'Suppliers', url: '/hms/purchasing/suppliers', icon: 'Truck', sort: 10, permission: 'suppliers:view' },
            { key: 'inv-po', label: 'Purchase Orders', url: '/hms/purchasing/orders', icon: 'FileText', sort: 20, permission: 'purchasing:view' },
            { key: 'inv-receipts', label: 'Goods Receipts', url: '/hms/purchasing/receipts', icon: 'ClipboardList', sort: 30, permission: 'purchasing:view' },
            { key: 'inv-returns', label: 'Purchase Returns', url: '/hms/purchasing/returns', icon: 'Undo2', sort: 40, permission: 'purchasing:returns:view' },
        ];

        // Ensure Dashboard is Top Level
        const dashKey = 'inv-dashboard';
        const existingDash = await prisma.menu_items.findFirst({ where: { key: dashKey } });
        if (!existingDash) {
            await prisma.menu_items.create({
                data: { label: 'Inventory Overview', url: '/hms/inventory', key: dashKey, module_key: 'inventory', icon: 'LayoutDashboard', sort_order: 5, permission_code: 'inventory:view', is_global: true }
            });
        } else if (!existingDash.permission_code || existingDash.parent_id || existingDash.label !== 'Inventory Overview') {
            await prisma.menu_items.update({ where: { id: existingDash.id }, data: { parent_id: null, permission_code: 'inventory:view', label: 'Inventory Overview' } });
        }
        // Ensure Product Master Exists
        const prodKey = 'inv-products';
        const existingProd = await prisma.menu_items.findFirst({ where: { key: prodKey } });
        if (!existingProd) {
            await prisma.menu_items.create({
                data: { label: 'Product Master', url: '/hms/inventory/products', key: prodKey, module_key: 'inventory', icon: 'Package', sort_order: 20, permission_code: 'inventory:view', is_global: true }
            });
        } else if (!existingProd.permission_code) {
            await prisma.menu_items.update({ where: { id: existingProd.id }, data: { permission_code: 'inventory:view' } });
        }

        // Ensure Bulk Import Exists (Direct Access)
        const importKey = 'inv-import';
        const existingImport = await prisma.menu_items.findFirst({ where: { key: importKey } });
        if (!existingImport) {
            await prisma.menu_items.create({
                data: { label: 'Bulk Import Products', url: '/hms/inventory/products?import=true', key: importKey, module_key: 'inventory', icon: 'Upload', sort_order: 21, permission_code: 'inventory:view', is_global: true }
            });
        } else if (existingImport.url !== '/hms/inventory/products?import=true') {
            await prisma.menu_items.update({ where: { id: existingImport.id }, data: { url: '/hms/inventory/products?import=true' } });
        }

        for (const item of items) {
            const existing = await prisma.menu_items.findFirst({ where: { key: item.key } });
            if (!existing) {
                await prisma.menu_items.create({
                    data: {
                        label: item.label,
                        url: item.url,
                        key: item.key,
                        module_key: 'inventory',
                        icon: item.icon,
                        parent_id: procParent.id,
                        sort_order: item.sort,
                        permission_code: item.permission,
                        is_global: true
                    }
                });
                console.log(`Auto-seeded Purchasing Menu: ${item.label}`);
            } else if (!existing.permission_code) {
                await prisma.menu_items.update({ where: { id: existing.id }, data: { permission_code: item.permission } });
            }
        }

        // Also ensure Sales Returns in Billing
        // Try to find the 'Billing' group or similar
        const billingMenu = await prisma.menu_items.findFirst({ where: { key: 'hms-billing' } });
        // hms-billing is usually a top level item or child. In fallback it was child of Income.
        // In HMS seeder, it's a top level item sort 60.

        // If billing is top level, we might want to make it a parent or add a sibling.
        // Let's add 'Credit Notes' as a top level item after Billing if Billing is top level.
        if (billingMenu) {
            const existingSR = await prisma.menu_items.findFirst({ where: { key: 'hms-sales-returns' } });
            if (!existingSR) {
                await prisma.menu_items.create({
                    data: {
                        label: 'Credit Notes',
                        url: '/hms/billing/returns',
                        key: 'hms-sales-returns',
                        module_key: 'hms',
                        icon: 'RotateCcw',
                        parent_id: billingMenu.parent_id, // Same level
                        sort_order: (billingMenu.sort_order || 60) + 1,
                        is_global: true
                    }
                });
                console.log("Auto-seeded Sales Returns Menu");
            }
        }

        // 3. CLEANUP: Delete any other items in 'inventory' module
        // const allowedKeys = ['inv-dashboard', 'inv-products', 'inv-procurement', 'inv-suppliers', 'inv-po', 'inv-receipts', 'inv-returns'];
        // Also keep 'hms-inventory' if it was somehow mapped to inventory, but we want to be strict.

        /* DISABLE CLEANUP TO PREVENT FK ERRORS
        await prisma.menu_items.deleteMany({
            where: {
                module_key: 'inventory',
                key: { notIn: allowedKeys }
            }
        });
        */

        // 3b. ADDITIONAL CLEANUP: Rogue Keys (True Bulletproof 2.0)
        // 1. Explicitly handle 'inventory-root' which acts as a parent
        const rogueRoot = await prisma.menu_items.findFirst({ where: { key: 'inventory-root' } });
        if (rogueRoot) {
            // Unlink any children pointing to this root
            await prisma.menu_items.updateMany({
                where: { parent_id: rogueRoot.id },
                data: { parent_id: null }
            });
            // Delete the root
            // await prisma.menu_items.delete({ where: { id: rogueRoot.id } }); // FK Error risk
        }

        // const rogueKeys = ['inv-receive', 'inventory.products', 'inv-moves']; // Removed hms.inventory
        // Unlink these specific keys if they have parents (nesting cleanup)
        /*
        await prisma.menu_items.updateMany({
            where: { key: { in: rogueKeys } },
            data: { parent_id: null }
        });
        // Delete them
        await prisma.menu_items.deleteMany({ where: { key: { in: rogueKeys } } });
        */

        // 4. STANDARDIZE: Update Sort Orders and Labels
        await prisma.menu_items.updateMany({ where: { key: 'inv-dashboard' }, data: { sort_order: 10, label: 'Inventory' } }); // Renamed to Inventory
        await prisma.menu_items.updateMany({ where: { key: 'inv-products' }, data: { sort_order: 20, label: 'Product Master' } });
        await prisma.menu_items.updateMany({ where: { key: 'inv-procurement' }, data: { sort_order: 30 } });

        // 5. MIGRATION: Move HMS Menus to Proper Modules (World Class Standard)
        // Move 'hms-accounting' to 'accounting' module
        await prisma.menu_items.updateMany({
            where: { key: 'hms-accounting' },
            data: { module_key: 'finance', sort_order: 10 }
        });
        // Ensure children follow (module_key is usually denormalized on parent, but good to be safe)
        const hmsAcc = await prisma.menu_items.findFirst({ where: { key: 'hms-accounting' } });
        if (hmsAcc) {
            await prisma.menu_items.updateMany({
                where: { parent_id: hmsAcc.id },
                data: { module_key: 'accounting' }
            });
        }

        // Move 'hms-inventory' to 'inventory' module
        await prisma.menu_items.updateMany({
            where: { key: 'hms-inventory' },
            data: { module_key: 'inventory', sort_order: 50, label: 'Pharmacy Store' } // Rename to distinguish
        });
        const hmsInv = await prisma.menu_items.findFirst({ where: { key: 'hms-inventory' } });
        if (hmsInv) {
            await prisma.menu_items.updateMany({
                where: { parent_id: hmsInv.id },
                data: { module_key: 'inventory' }
            });
        }

        // Move 'hms-purchasing' to 'inventory' module (Procurement)
        await prisma.menu_items.updateMany({
            where: { key: 'hms-purchasing' },
            data: { module_key: 'inventory', sort_order: 60, label: 'Central Purchasing' }
        });
        const hmsPurch = await prisma.menu_items.findFirst({ where: { key: 'hms-purchasing' } });
        if (hmsPurch) {
            await prisma.menu_items.updateMany({
                where: { parent_id: hmsPurch.id },
                data: { module_key: 'inventory' }
            });
        }

    } catch (e) {
        console.error("Failed to seed Purchasing menus:", e);
    }
}
