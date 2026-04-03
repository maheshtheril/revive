const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function run() {
    console.log("🚀 Starting Direct SQL Sync for Customer DB...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Rename and ensure modules
        console.log("📦 Syncing Modules...");
        await client.query(`
            INSERT INTO "modules" (id, module_key, name, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), 'hms', 'Hospital', true, now(), now())
            ON CONFLICT (module_key) DO UPDATE SET name = 'Hospital', is_active = true, updated_at = now();
        `);
        await client.query(`
            INSERT INTO "modules" (id, module_key, name, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), 'finance', 'Gateway of Tally', true, now(), now())
            ON CONFLICT (module_key) DO UPDATE SET name = 'Gateway of Tally', is_active = true, updated_at = now();
        `);
        await client.query(`
            INSERT INTO "modules" (id, module_key, name, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), 'inventory', 'Inventory & Procurement', true, now(), now())
            ON CONFLICT (module_key) DO UPDATE SET name = 'Inventory & Procurement', is_active = true, updated_at = now();
        `);

        // 2. Enable Inventory for all tenants
        console.log("🏢 Enabling Inventory for all tenants...");
        await client.query(`
            INSERT INTO "tenant_module" (id, tenant_id, module_key, enabled, created_at, updated_at)
            SELECT gen_random_uuid(), id, 'inventory', true, now(), now() FROM "tenant"
            ON CONFLICT DO NOTHING;
        `);
        await client.query(`
            UPDATE "tenant_module" SET enabled = true WHERE module_key = 'inventory';
        `);

        // 3. Procurement Parent Menu
        console.log("📋 Syncing Procurement Menus...");
        const procExists = await client.query('SELECT id FROM menu_items WHERE key = $1', ['inv-procurement']);
        let procId;
        if (procExists.rows.length > 0) {
            procId = procExists.rows[0].id;
            await client.query(`
                UPDATE menu_items 
                SET label = 'Procurement', module_key = 'inventory', sort_order = 15, url = '#', parent_id = NULL
                WHERE id = $1
            `, [procId]);
        } else {
            const res = await client.query(`
                INSERT INTO menu_items (id, label, url, key, module_key, icon, sort_order, is_global, permission_code)
                VALUES (gen_random_uuid(), 'Procurement', '#', 'inv-procurement', 'inventory', 'ShoppingCart', 15, true, 'purchasing:view')
                RETURNING id
            `);
            procId = res.rows[0].id;
        }

        // 4. Submenus
        const submenus = [
            ['Suppliers', '/hms/purchasing/suppliers', 'inv-suppliers', 'Truck', 10, 'suppliers:view'],
            ['Purchase Orders', '/hms/purchasing/orders', 'inv-po', 'FileText', 20, 'purchasing:view'],
            ['Goods Receipts', '/hms/purchasing/receipts', 'inv-receipts', 'ClipboardList', 30, 'purchasing:view'],
            ['Purchase Returns', '/hms/purchasing/returns', 'inv-returns', 'Undo2', 40, 'purchasing:returns:view']
        ];

        for (const [label, url, key, icon, sort, perm] of submenus) {
            const subExists = await client.query('SELECT id FROM menu_items WHERE key = $1', [key]);
            if (subExists.rows.length > 0) {
                await client.query(`
                    UPDATE menu_items 
                    SET label = $1, url = $2, parent_id = $3, module_key = 'inventory'
                    WHERE id = $4
                `, [label, url, procId, subExists.rows[0].id]);
            } else {
                await client.query(`
                    INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
                    VALUES (gen_random_uuid(), $1, $2, $3, 'inventory', $4, $5, $6, true, $7)
                `, [label, url, key, icon, procId, sort, perm]);
            }
        }

        // 5. HMS Masters
        console.log("⚙️ Syncing HMS Masters...");
        const masterExists = await client.query('SELECT id FROM menu_items WHERE key = $1', ['hms-masters']);
        let masterId;
        if (masterExists.rows.length > 0) {
            masterId = masterExists.rows[0].id;
            await client.query(`
                UPDATE menu_items SET label = 'MASTERS', url = '#', module_key = 'hms', sort_order = 5 WHERE id = $1
            `, [masterId]);
        } else {
            const res = await client.query(`
                INSERT INTO menu_items (id, label, url, key, module_key, icon, sort_order, is_global, permission_code)
                VALUES (gen_random_uuid(), 'MASTERS', '#', 'hms-masters', 'hms', 'Settings', 5, true, 'hms:admin')
                RETURNING id
            `);
            masterId = res.rows[0].id;
        }

        // 6. Clinical Protocols under Masters
        const protoExists = await client.query('SELECT id FROM menu_items WHERE key = $1', ['hms-clinical-protocols']);
        if (protoExists.rows.length > 0) {
            await client.query('UPDATE menu_items SET parent_id = $1 WHERE id = $2', [masterId, protoExists.rows[0].id]);
        } else {
            await client.query(`
                INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code)
                VALUES (gen_random_uuid(), 'Clinical Protocols', '/hms/settings/prescriptions', 'hms-clinical-protocols', 'hms', 'FileText', $1, 10, true, 'hms:admin')
            `, [masterId]);
        }

        await client.query('COMMIT');
        console.log("🏁 Direct SQL Sync Complete!");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ SQL Sync Error:", e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
