import { prisma } from "@/lib/prisma"

export async function ensureAccountingMenu() {
    try {
        // 1. FINANCIAL MANAGEMENT (ACCOUNTS PILLAR)
        
<<<<<<< HEAD
        // --- REVENUE CENTER (Income Nodes) ---
        let revParent = await prisma.menu_items.findFirst({ where: { key: 'fin-revenue' } });
        if (!revParent) {
            revParent = await prisma.menu_items.create({
                data: { label: 'REVENUE CENTER', url: '#', key: 'fin-revenue', module_key: 'finance', icon: 'DollarSign', sort_order: 10, is_global: true }
=======
        // 3. SEED TRANSACTIONS
        await ensureTransactionMenus();

        // 4. SEED MASTERS
        await ensureAccountingMasters();

    } catch (e) {
        console.error("Failed to auto-seed menu:", e);
    }
}

async function ensureAccountingMasters() {
    let masterParent = await prisma.menu_items.findFirst({ where: { key: 'acc-masters' } });
    if (!masterParent) {
        masterParent = await prisma.menu_items.create({
            data: { label: 'MASTERS', url: '#', key: 'acc-masters', module_key: 'finance', icon: 'Settings', sort_order: 10, is_global: true, permission_code: 'billing:view' }
        });
    }

    const coaMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-coa' } });
    if (!coaMenu) {
        await prisma.menu_items.create({
            data: { label: 'Chart of Accounts', url: '/hms/accounting/coa', key: 'acc-coa', module_key: 'finance', icon: 'ListTree', parent_id: masterParent.id, sort_order: 10, is_global: true, permission_code: 'billing:view' }
        });
    }
}

async function ensureTransactionMenus() {
    let transParent = await prisma.menu_items.findFirst({ where: { key: 'acc-transactions' } });
    if (!transParent) {
        transParent = await prisma.menu_items.create({
            data: { label: 'TRANSACTIONS', url: '#', key: 'acc-transactions', module_key: 'finance', icon: 'ArrowRightLeft', sort_order: 20, is_global: true, permission_code: 'billing:view' }
        });
    }

    const paymentMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-payments' } });
    if (!paymentMenu) {
        await prisma.menu_items.create({
            data: { label: 'Payment Vouchers', url: '/hms/accounting/payments', key: 'acc-payments', module_key: 'finance', icon: 'ArrowUpRight', parent_id: transParent.id, sort_order: 10, is_global: true, permission_code: 'billing:view' }
        });
    }

    const receiptMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-receipts' } });
    if (!receiptMenu) {
        await prisma.menu_items.create({
            data: { label: 'Receipt Vouchers', url: '/hms/accounting/receipts', key: 'acc-receipts', module_key: 'finance', icon: 'ArrowDownLeft', parent_id: transParent.id, sort_order: 20, is_global: true, permission_code: 'billing:view' }
        });
    }

    const journalMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-journals' } });
    if (!journalMenu) {
        await prisma.menu_items.create({
            data: { label: 'Journal Register', url: '/hms/accounting/journals', key: 'acc-journals', module_key: 'finance', icon: 'BookOpen', parent_id: transParent.id, sort_order: 30, is_global: true, permission_code: 'billing:view' }
        });
    }

    const creditNoteMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-credit-note' } });
    if (!creditNoteMenu) {
        await prisma.menu_items.create({
            data: { label: 'Credit Note', url: '/hms/billing/returns', key: 'acc-credit-note', module_key: 'finance', icon: 'Ticket', parent_id: transParent.id, sort_order: 40, is_global: true, permission_code: 'billing:view' }
        });
    }

    const debitNoteMenu = await prisma.menu_items.findFirst({ where: { key: 'acc-debit-note' } });
    if (!debitNoteMenu) {
        await prisma.menu_items.create({
            data: { label: 'Debit Note', url: '/hms/accounting/debit-notes', key: 'acc-debit-note', module_key: 'finance', icon: 'Ticket', parent_id: transParent.id, sort_order: 50, is_global: true, permission_code: 'billing:view' }
        });
    }
}

async function ensureLedgerReports() {
    let reportParent = await prisma.menu_items.findFirst({ where: { key: 'acc-reports' } });
    if (!reportParent) {
        reportParent = await prisma.menu_items.create({
            data: { label: 'REPORTS', url: '#', key: 'acc-reports', module_key: 'finance', icon: 'BarChart3', sort_order: 30, is_global: true, permission_code: 'billing:view' }
        });
    }

    const reports = [
        { key: 'acc-bs', label: 'Balance Sheet', url: '/hms/accounting?view=classic&tab=bs', icon: 'Scale', sort: 10 },
        { key: 'acc-pl', label: 'Profit & Loss A/c', url: '/hms/accounting?view=classic&tab=pl', icon: 'TrendingUp', sort: 20 },
        { key: 'acc-tb', label: 'Trial Balance', url: '/hms/accounting/trial-balance', icon: 'Activity', sort: 30 },
        { key: 'acc-db', label: 'Day Book', url: '/hms/accounting/daybook', icon: 'BookOpen', sort: 40 },
        { key: 'acc-cb', label: 'Cash / Bank Book', url: '/hms/accounting/cashbook', icon: 'Banknote', sort: 50 },
        { key: 'acc-ageing', label: 'Bill-wise Ageing Analysis', url: '/hms/accounting/ageing', icon: 'History', sort: 60 },
    ];

    for (const r of reports) {
        const existing = await prisma.menu_items.findFirst({ where: { key: r.key } });
        if (!existing) {
            await prisma.menu_items.create({
                data: { label: r.label, url: r.url, key: r.key, module_key: 'finance', icon: r.icon, parent_id: reportParent.id, sort_order: r.sort, is_global: true, permission_code: 'billing:view' }
            });
        }
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
            { key: 'audit-logs', label: 'System Audit Log', url: '/settings/audit-logs', icon: 'History', sort: 93, permission: 'settings:view' },
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
>>>>>>> 5fa1f8d3a774f449029a8d86d52c17bf2b97038e
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['hms-billing', 'hms-pharmacy-billing', 'hms-billing-direct', 'hms-sales-returns'] } },
            data: { parent_id: revParent.id, module_key: 'finance' }
        });

        // --- VOUCHERS & TRANSACTIONS (Financial Movements) ---
        let transParent = await prisma.menu_items.findFirst({ where: { key: 'fin-vouchers' } });
        if (!transParent) {
            transParent = await prisma.menu_items.create({
                data: { label: 'VOUCHER ENTRY', url: '#', key: 'fin-vouchers', module_key: 'finance', icon: 'ArrowRightLeft', sort_order: 20, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['acc-payments', 'acc-receipts', 'acc-journals', 'acc-credit-note', 'acc-debit-note'] } },
            data: { parent_id: transParent.id, module_key: 'finance' }
        });

        // --- ACCOUNTING MASTERS (Configuration) ---
        let accMasterParent = await prisma.menu_items.findFirst({ where: { key: 'fin-masters' } });
        if (!accMasterParent) {
            accMasterParent = await prisma.menu_items.create({
                data: { label: 'MASTERS', url: '#', key: 'fin-masters', module_key: 'finance', icon: 'Settings', sort_order: 30, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['acc-coa'] } },
            data: { parent_id: accMasterParent.id, module_key: 'finance' }
        });

        // --- FINANCIAL AUDIT (Tally Reports) ---
        let auditParent = await prisma.menu_items.findFirst({ where: { key: 'fin-audit' } });
        if (!auditParent) {
            auditParent = await prisma.menu_items.create({
                data: { label: 'AUDIT & STATEMENTS', url: '#', key: 'fin-audit', module_key: 'finance', icon: 'BarChart3', sort_order: 40, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['acc-bs', 'acc-pl', 'acc-tb', 'acc-db', 'acc-cb', 'acc-ageing', 'acc-ledger'] } },
            data: { parent_id: auditParent.id, module_key: 'finance' }
        });

    } catch (e) {
        console.error("Failed to seed Accounting menu:", e);
    }
}

export async function ensureHmsMenus() {
    try {
        // 2. CLINICAL & HOSPITAL MANAGEMENT (HMS PILLAR)

        // --- FRONT OFFICE (Reception & Registration) ---
        let frontParent = await prisma.menu_items.findFirst({ where: { key: 'hms-front-office' } });
        if (!frontParent) {
            frontParent = await prisma.menu_items.create({
                data: { label: 'FRONT OFFICE', url: '#', key: 'hms-front-office', module_key: 'hms', icon: 'MonitorCheck', sort_order: 10, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['hms-reception', 'hms-op-reg', 'hms-appointments', 'hms-patients'] } },
            data: { parent_id: frontParent.id, module_key: 'hms' }
        });

        // --- CLINICAL HUB (Doctors & Nursing) ---
        let clinParent = await prisma.menu_items.findFirst({ where: { key: 'hms-clinical' } });
        if (!clinParent) {
            clinParent = await prisma.menu_items.create({
                data: { label: 'CLINICAL HUB', url: '#', key: 'hms-clinical', module_key: 'hms', icon: 'Stethoscope', sort_order: 20, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['hms-doctors', 'hms-doctor-dash', 'hms-nursing', 'hms-wards'] } },
            data: { parent_id: clinParent.id, module_key: 'hms' }
        });

        // --- DIAGNOSTICS (Test Centers) ---
        let diagParent = await prisma.menu_items.findFirst({ where: { key: 'hms-diagnostics' } });
        if (!diagParent) {
            diagParent = await prisma.menu_items.create({
                data: { label: 'DIAGNOSTICS', url: '#', key: 'hms-diagnostics', module_key: 'hms', icon: 'FlaskConical', sort_order: 30, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['hms-lab', 'lab-pending', 'lab-orders', 'hms-lab-tests'] } },
            data: { parent_id: diagParent.id, module_key: 'hms' }
        });

        // --- CLINICAL CONFIG (Masters) ---
        let hmsMasterParent = await prisma.menu_items.findFirst({ where: { key: 'hms-config' } });
        if (!hmsMasterParent) {
            hmsMasterParent = await prisma.menu_items.create({
                data: { label: 'MASTERS', url: '#', key: 'hms-config', module_key: 'hms', icon: 'Settings', sort_order: 40, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['hms-clinical-protocols', 'hms-masters'] } },
            data: { parent_id: hmsMasterParent.id, module_key: 'hms' }
        });

    } catch (e) {
        console.error("Failed to seed HMS menus:", e);
    }
}

export async function ensurePurchasingMenus() {
    try {
        // 3. SUPPLY CHAIN & WAREHOUSE (INVENTORY PILLAR)

        // --- CENTRAL PROCUREMENT (Supply Logic) ---
        let procParent = await prisma.menu_items.findFirst({ where: { key: 'inv-procurement-root' } });
        if (!procParent) {
            procParent = await prisma.menu_items.create({
                data: { label: 'PROCUREMENT', url: '#', key: 'inv-procurement-root', module_key: 'inventory', icon: 'ShoppingCart', sort_order: 10, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['inv-suppliers', 'inv-po', 'inv-receipts', 'inv-returns'] } },
            data: { parent_id: procParent.id, module_key: 'inventory' }
        });

        // --- WAREHOUSE & STOCK (Store Logic) ---
        let storeParent = await prisma.menu_items.findFirst({ where: { key: 'inv-warehouse' } });
        if (!storeParent) {
            storeParent = await prisma.menu_items.create({
                data: { label: 'WAREHOUSE / STOCK', url: '#', key: 'inv-warehouse', module_key: 'inventory', icon: 'Package', sort_order: 20, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['inv-products', 'inv-import', 'inv-register', 'inv-stock-report'] } },
            data: { parent_id: storeParent.id, module_key: 'inventory' }
        });

    } catch (e) {
        console.error("Failed to seed Inventory menus:", e);
    }
}

export async function ensureWorkforceMenus() {
    try {
        // 4. WORKFORCE & BUSINESS DEV (WORKFORCE PILLAR)

        // --- HR & STAFF (Human Capital) ---
        let hrParent = await prisma.menu_items.findFirst({ where: { key: 'crm-workforce' } });
        if (!hrParent) {
            hrParent = await prisma.menu_items.create({
                data: { label: 'STAFF & HR', url: '#', key: 'crm-workforce', module_key: 'crm', icon: 'Users', sort_order: 10, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['crm-employees', 'crm-departments', 'crm-designations', 'crm-org-chart', 'hms-attendance', 'hms-roster', 'hms-attendance-analytics'] } },
            data: { parent_id: hrParent.id, module_key: 'crm' }
        });

        // --- CRM (Leads & Growth) ---
        let crmParent = await prisma.menu_items.findFirst({ where: { key: 'crm-growth' } });
        if (!crmParent) {
            crmParent = await prisma.menu_items.create({
                data: { label: 'BUSINESS DEVELOPMENT', url: '#', key: 'crm-growth', module_key: 'crm', icon: 'TrendingUp', sort_order: 20, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['crm-leads', 'crm-deals', 'crm-activities', 'crm-targets', 'crm-masters'] } },
            data: { parent_id: crmParent.id, module_key: 'crm' }
        });

    } catch (e) {
        console.error("Failed to seed Workforce menus:", e);
    }
}

export async function ensureAdminMenus() {
    try {
        // 5. SYSTEM SETTINGS & CORE (SETTINGS PILLAR)

        // --- CORE SETTINGS ---
        let coreParent = await prisma.menu_items.findFirst({ where: { key: 'sys-setup' } });
        if (!coreParent) {
            coreParent = await prisma.menu_items.create({
                data: { label: 'FACILITY CONTROL', url: '#', key: 'sys-setup', module_key: 'configuration', icon: 'Building2', sort_order: 10, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['settings-company', 'settings-branches', 'settings-tax', 'settings-branding'] } },
            data: { parent_id: coreParent.id, module_key: 'configuration' }
        });

        // --- SECURITY & AI (RBAC) ---
        let secureParent = await prisma.menu_items.findFirst({ where: { key: 'sys-security' } });
        if (!secureParent) {
            secureParent = await prisma.menu_items.create({
                data: { label: 'SECURITY & RBAC', url: '#', key: 'sys-security', module_key: 'configuration', icon: 'ShieldCheck', sort_order: 20, is_global: true }
            });
        }

        await prisma.menu_items.updateMany({
            where: { key: { in: ['settings-users', 'settings-rbac', 'settings-ai', 'settings-logs'] } },
            data: { parent_id: secureParent.id, module_key: 'configuration' }
        });

    } catch (e) {
        console.error("Failed to seed Admin menus:", e);
    }
}

export async function ensureCrmMenus() {
    // This is now handled by ensureWorkforceMenus for better nomenclature
    return ensureWorkforceMenus();
}
