import { prisma } from "@/lib/prisma"

export async function ensureAccountingMenu() {
    try {
        // 1. FINANCIAL MANAGEMENT (ACCOUNTS PILLAR)
        
        // --- REVENUE CENTER (Income Nodes) ---
        let revParent = await prisma.menu_items.findFirst({ where: { key: 'fin-revenue' } });
        if (!revParent) {
            revParent = await prisma.menu_items.create({
                data: { label: 'REVENUE CENTER', url: '#', key: 'fin-revenue', module_key: 'finance', icon: 'DollarSign', sort_order: 10, is_global: true }
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
