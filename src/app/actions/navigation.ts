'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getUserPermissions, seedRolesAndPermissions } from "./rbac"
import { unstable_noStore as noStore } from 'next/cache';

export async function getMenuItems() {
    noStore();
    const session = await auth();
    if (!session?.user) return getFallbackMenuItems(false);

    const isAdmin = session?.user?.isAdmin || (session?.user as any)?.isTenantAdmin;
    const userId = session?.user?.id;
    const tenantId = session?.user?.tenantId;

    const [userPermsRaw, globalActiveModules, tenantModules, allMenuItems] = await Promise.all([
        userId ? getUserPermissions(userId) : Promise.resolve([]),
        prisma.modules.findMany({ where: { is_active: true } }),
        tenantId ? prisma.tenant_module.findMany({ where: { tenant_id: tenantId, enabled: true } }) : Promise.resolve([]),
        prisma.menu_items.findMany({
            orderBy: { sort_order: 'asc' },
            include: { module_menu_map: { include: { modules: true } } }
        })
    ]);

    const userPerms = new Set(Array.isArray(userPermsRaw) ? userPermsRaw : []);
    if (isAdmin) userPerms.add('*');

    try {
        const industryName = (session?.user as any)?.industry || '';
        let allowedModuleKeys = new Set<string>();

        if (tenantId) {
            tenantModules.forEach(tm => allowedModuleKeys.add(tm.module_key));
            if (tenantModules.length === 0) {
                allowedModuleKeys.add('hms');
                allowedModuleKeys.add('finance');
                allowedModuleKeys.add('inventory');
            }
        } else {
            globalActiveModules.forEach(m => allowedModuleKeys.add(m.module_key));
        }

        allowedModuleKeys.add('general');
        allowedModuleKeys.add('finance');
        allowedModuleKeys.add('configuration');

        if (session?.user?.role?.toLowerCase() === 'nurse') {
            return [
                {
                    module: { name: 'Hospital', module_key: 'hms' },
                    items: [
                        { key: 'hms-nursing', label: 'Nursing Station', url: '/hms/nursing/dashboard', icon: 'Activity', sort_order: 1, permission_code: 'hms:dashboard:nurse', is_global: true, module_key: 'hms' }
                    ]
                }
            ];
        }

        const itemMap = new Map();
        const rootItems: any[] = [];
        allMenuItems.forEach(item => { itemMap.set(item.id, { ...item, other_menu_items: [] }); });
        allMenuItems.forEach(item => {
            const node = itemMap.get(item.id);
            if (item.parent_id && itemMap.has(item.parent_id)) {
                itemMap.get(item.parent_id).other_menu_items.push(node);
            } else {
                rootItems.push(node);
            }
        });

        const grouped: Record<string, { module: any, items: any[] }> = {};
        for (const mod of globalActiveModules) {
            if (allowedModuleKeys.has(mod.module_key)) {
                grouped[mod.module_key] = { module: mod, items: [] };
            }
        }

        if (!grouped['finance']) grouped['finance'] = { module: { name: 'ACCOUNTS', module_key: 'finance' }, items: [] };
        if (!grouped['general']) grouped['general'] = { module: { name: 'DASHBOARD', module_key: 'general' }, items: [] };
        if (!grouped['inventory']) grouped['inventory'] = { module: { name: 'INVENTORY', module_key: 'inventory' }, items: [] };
        if (!grouped['crm']) grouped['crm'] = { module: { name: 'WORKFORCE', module_key: 'crm' }, items: [] };
        if (!grouped['configuration']) grouped['configuration'] = { module: { name: 'SETTINGS', module_key: 'configuration' }, items: [] };
        if (!grouped['hms']) grouped['hms'] = { module: { name: 'HMS (CLINICAL)', module_key: 'hms' }, items: [] };


        for (const item of rootItems) {
            const modKey = item.module_key || (item.module_menu_map?.[0]?.module_key) || 'general';
            if (allowedModuleKeys.has(modKey)) {
                if (!grouped[modKey]) grouped[modKey] = { module: { name: modKey.toUpperCase(), module_key: modKey }, items: [] };
                grouped[modKey].items.push(item);
            }
        }

        const filterRestricted = (items: any[]) => {
            return items.filter(item => (!item.permission_code || userPerms.has(item.permission_code) || userPerms.has('*')));
        };

        Object.keys(grouped).forEach(key => {
            grouped[key].items = filterRestricted(grouped[key].items);
        });

        const priority = ['hms', 'finance', 'inventory', 'crm', 'configuration'];

        return Object.values(grouped)
            .filter(g => g.items.length > 0)
            .sort((a, b) => {
                const indexA = priority.indexOf(a.module?.module_key || '');
                const indexB = priority.indexOf(b.module?.module_key || '');
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                return (a.module?.name || '').localeCompare(b.module?.name || '');
            });

    } catch (error) {
        return getFallbackMenuItems(isAdmin);
    }
}

import { ensureHmsMenus, ensureAdminMenus, ensureAccountingMenu, ensureCrmMenus, ensurePurchasingMenus } from "@/lib/menu-seeder";

export async function auditAndFixMenuPermissions() { 
    try {
        await Promise.all([
            ensureHmsMenus(),
            ensureAdminMenus(),
            ensureAccountingMenu(),
            ensureCrmMenus(),
            ensurePurchasingMenus()
        ]);
        return { success: true };
    } catch (e) {
        console.error("Navigation Audit Failed:", e);
        return { success: false };
    }
}

function getFallbackMenuItems(isAdmin: boolean) {
    return [
        {
            module: { name: 'Hospital', module_key: 'hms' },
            items: [
                { key: 'hms-dashboard', label: 'HMS Dashboard', icon: 'Activity', url: '/hms/dashboard' },
                { key: 'hms-patients', label: 'Patient Registry', icon: 'Users', url: '/hms/patients' }
            ]
        }
    ];
}
