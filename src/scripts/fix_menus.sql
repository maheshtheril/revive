-- 1. Update Module Names Globally
UPDATE modules SET name = 'Hospital' WHERE module_key = 'hms';
UPDATE modules SET name = 'Gateway of Tally' WHERE module_key = 'finance';

-- 2. Ensure Inventory Module exists and is active globally
INSERT INTO modules (module_key, name, is_active)
VALUES ('inventory', 'Inventory & Procurement', true)
ON CONFLICT (module_key) DO UPDATE SET is_active = true, name = 'Inventory & Procurement';

-- 3. ENSURE ALL TENANTS HAVE INVENTORY ENABLED
-- This fixes the issue where some customers wouldn't see the Procurement menu
INSERT INTO tenant_module (tenant_id, module_key, enabled)
SELECT DISTINCT tenant_id, 'inventory', true FROM tenant_module
ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = true;

-- 4. Sync Procurement Parent Menu (Top Level or under Inventory)
-- We set it as a top-level group for visibility
INSERT INTO menu_items (label, url, key, module_key, icon, sort_order, is_global, permission_code)
VALUES ('Procurement', '#', 'inv-procurement', 'inventory', 'ShoppingCart', 15, true, 'purchasing:view')
ON CONFLICT (key) DO UPDATE SET 
    label = 'Procurement', 
    module_key = 'inventory', 
    sort_order = 15,
    url = '#',
    parent_id = NULL;

-- 5. Sync Submenus (Suppliers, Orders, Receipts, Returns)
INSERT INTO menu_items (label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
SELECT 'Suppliers', '/hms/purchasing/suppliers', 'inv-suppliers', 'inventory', 'Truck', id, 10, true, 'suppliers:view'
FROM menu_items WHERE key = 'inv-procurement'
ON CONFLICT (key) DO UPDATE SET 
    label = 'Suppliers', 
    url = '/hms/purchasing/suppliers', 
    parent_id = (SELECT id FROM menu_items WHERE key = 'inv-procurement'), 
    module_key = 'inventory';

INSERT INTO menu_items (label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
SELECT 'Purchase Orders', '/hms/purchasing/orders', 'inv-po', 'inventory', 'FileText', id, 20, true, 'purchasing:view'
FROM menu_items WHERE key = 'inv-procurement'
ON CONFLICT (key) DO UPDATE SET 
    label = 'Purchase Orders', 
    url = '/hms/purchasing/orders', 
    parent_id = (SELECT id FROM menu_items WHERE key = 'inv-procurement'), 
    module_key = 'inventory';

INSERT INTO menu_items (label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
SELECT 'Goods Receipts', '/hms/purchasing/receipts', 'inv-receipts', 'inventory', 'ClipboardList', id, 30, true, 'purchasing:view'
FROM menu_items WHERE key = 'inv-procurement'
ON CONFLICT (key) DO UPDATE SET 
    label = 'Goods Receipts', 
    url = '/hms/purchasing/receipts', 
    parent_id = (SELECT id FROM menu_items WHERE key = 'inv-procurement'), 
    module_key = 'inventory';

INSERT INTO menu_items (label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
SELECT 'Purchase Returns', '/hms/purchasing/returns', 'inv-returns', 'inventory', 'Undo2', id, 40, true, 'purchasing:returns:view'
FROM menu_items WHERE key = 'inv-procurement'
ON CONFLICT (key) DO UPDATE SET 
    label = 'Purchase Returns', 
    url = '/hms/purchasing/returns', 
    parent_id = (SELECT id FROM menu_items WHERE key = 'inv-procurement'), 
    module_key = 'inventory';

-- 6. Ensure Masters (HMS) is working (if it's a parent, it must have children and correct URL)
UPDATE menu_items SET url = '#' WHERE key = 'hms-masters';
-- Ensure children for HMS Masters
INSERT INTO menu_items (label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
SELECT 'Clinical Protocols', '/hms/settings/prescriptions', 'hms-clinical-protocols', 'hms', 'FileText', id, 10, true, 'hms:admin'
FROM menu_items WHERE key = 'hms-masters'
ON CONFLICT (key) DO UPDATE SET parent_id = (SELECT id FROM menu_items WHERE key = 'hms-masters');

