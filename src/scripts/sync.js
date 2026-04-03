require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sync() {
    console.log("🚀 Starting Comprehensive Menu & Module Sync...");
    
    // 1. Rename Core Modules
    const hmsModule = await prisma.modules.findUnique({ where: { module_key: 'hms' } });
    if (hmsModule) {
        await prisma.modules.update({ where: { module_key: 'hms' }, data: { name: 'Hospital', is_active: true } });
    } else {
        await prisma.modules.create({ data: { module_key: 'hms', name: 'Hospital', is_active: true } });
    }
    console.log("✅ Module 'hms' synced.");
    console.log("✅ Module 'hms' renamed to 'Hospital'.");

    const financeModule = await prisma.modules.findUnique({ where: { module_key: 'finance' } });
    if (financeModule) {
        await prisma.modules.update({ where: { module_key: 'finance' }, data: { name: 'Gateway of Tally', is_active: true } });
    } else {
        await prisma.modules.create({ data: { module_key: 'finance', name: 'Gateway of Tally', is_active: true } });
    }
    console.log("✅ Module 'finance' synced.");
    console.log("✅ Module 'finance' renamed to 'Gateway of Tally'.");

    // 2. Ensure Inventory Module is active
    const invModule = await prisma.modules.findUnique({ where: { module_key: 'inventory' } });
    if (invModule) {
        await prisma.modules.update({ where: { module_key: 'inventory' }, data: { is_active: true, name: 'Inventory & Procurement' } });
    } else {
        await prisma.modules.create({ data: { module_key: 'inventory', name: 'Inventory & Procurement', is_active: true } });
    }
    console.log("✅ Module 'inventory' synced.");
    console.log("✅ Module 'inventory' is active.");

    // 3. ENABLE INVENTORY FOR ALL TENANTS
    // This is the "secret sauce" to make it show up in the sidebar
    const tenants = await prisma.tenant_module.findMany({
        distinct: ['tenant_id']
    });
    
    for (const t of tenants) {
        const existing = await prisma.tenant_module.findFirst({
            where: {
                tenant_id: t.tenant_id,
                module_key: 'inventory'
            }
        });

        if (existing) {
            await prisma.tenant_module.update({
                where: { id: existing.id },
                data: { enabled: true }
            });
        } else {
            await prisma.tenant_module.create({
                data: { 
                    tenant_id: t.tenant_id, 
                    module_key: 'inventory', 
                    enabled: true 
                }
            });
        }
    }
    console.log(`✅ Inventory module enabled for ${tenants.length} tenants.`);

    // 4. Ensure Procurement Parent
    let procParent = await prisma.menu_items.findFirst({ where: { key: 'inv-procurement' } });
    const procData = { label: 'Procurement', url: '#', key: 'inv-procurement', module_key: 'inventory', icon: 'ShoppingCart', sort_order: 15, is_global: true, permission_code: 'purchasing:view' };
    
    if (procParent) {
        procParent = await prisma.menu_items.update({
            where: { id: procParent.id },
            data: { label: 'Procurement', module_key: 'inventory', sort_order: 15, url: '#' }
        });
    } else {
        procParent = await prisma.menu_items.create({ data: procData });
    }
    console.log("✅ Procurement Parent synced.");
    console.log("✅ Procurement Parent synced.");

    // 5. Submenus
    const items = [
        { key: 'inv-suppliers', label: 'Suppliers', url: '/hms/purchasing/suppliers', icon: 'Truck', sort: 10, permission: 'suppliers:view' },
        { key: 'inv-po', label: 'Purchase Orders', url: '/hms/purchasing/orders', icon: 'FileText', sort: 20, permission: 'purchasing:view' },
        { key: 'inv-receipts', label: 'Goods Receipts', url: '/hms/purchasing/receipts', icon: 'ClipboardList', sort: 30, permission: 'purchasing:view' },
        { key: 'inv-returns', label: 'Purchase Returns', url: '/hms/purchasing/returns', icon: 'Undo2', sort: 40, permission: 'purchasing:returns:view' },
    ];

    for (const item of items) {
        const existing = await prisma.menu_items.findFirst({ where: { key: item.key } });
        const itemData = { label: item.label, url: item.url, key: item.key, module_key: 'inventory', icon: item.icon, parent_id: procParent.id, sort_order: item.sort, is_global: true, permission_code: item.permission };
        
        if (existing) {
            await prisma.menu_items.update({
                where: { id: existing.id },
                data: { label: item.label, url: item.url, parent_id: procParent.id, module_key: 'inventory' }
            });
        } else {
            await prisma.menu_items.create({ data: itemData });
        }
        console.log(`✅ Submenu synced: ${item.label}`);
    }

    // 6. Fix HMS Masters
    let mastersParent = await prisma.menu_items.findFirst({ where: { key: 'hms-masters' } });
    if (mastersParent) {
        mastersParent = await prisma.menu_items.update({
            where: { id: mastersParent.id },
            data: { label: 'MASTERS', url: '#', module_key: 'hms', sort_order: 5 }
        });
    } else {
        mastersParent = await prisma.menu_items.create({
            data: { label: 'MASTERS', url: '#', key: 'hms-masters', module_key: 'hms', icon: 'Settings', sort_order: 5, is_global: true, permission_code: 'hms:admin' }
        });
    }
    
    // Add a child to MASTERS if none exists to ensure it's expandable
    const protoExisting = await prisma.menu_items.findFirst({ where: { key: 'hms-clinical-protocols' } });
    if (protoExisting) {
        await prisma.menu_items.update({
            where: { id: protoExisting.id },
            data: { parent_id: mastersParent.id }
        });
    } else {
        await prisma.menu_items.create({
            data: { label: 'Clinical Protocols', url: '/hms/settings/prescriptions', key: 'hms-clinical-protocols', module_key: 'hms', icon: 'FileText', parent_id: mastersParent.id, sort_order: 10, is_global: true, permission_code: 'hms:admin' }
        });
    }

    console.log("🏁 Sync Complete!");
    process.exit(0);
}

sync().catch(err => {
    console.error("❌ Sync Error:", err);
    process.exit(1);
});

