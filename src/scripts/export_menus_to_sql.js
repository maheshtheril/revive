const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function run() {
    console.log("🚀 Exporting Laptop Menus... This will be your raw SQL for pgAdmin.");
    const client = await pool.connect();
    try {
        const modules = await client.query('SELECT * FROM modules');
        const menus = await client.query('SELECT * FROM menu_items');

        let sql = `
-- ===========================================
-- ZIONA HMS - MASTER MENU RECOVERY SQL
-- RUN THIS IN PGADMIN 4 ON THE CUSTOMER SERVER
-- ===========================================

-- 1. DELETE OLD BROKEN DATA
TRUNCATE TABLE menu_items, modules CASCADE;

-- 2. INSERT MASTER MODULES
INSERT INTO modules (id, module_key, name, is_active, created_at, updated_at) VALUES 
`;

        const modValues = modules.rows.map(m => 
            `('${m.id}', '${m.module_key}', '${m.name.replace(/'/g, "''")}', ${m.is_active}, '${m.created_at.toISOString()}', '${m.updated_at.toISOString()}')`
        ).join(',\n');
        
        sql += modValues + ';\n\n';

        sql += `-- 3. INSERT MASTER ROOT MENUS\n`;
        sql += `INSERT INTO menu_items (id, label, url, key, module_key, icon, sort_order, is_global, permission_code, created_at, updated_at) VALUES \n`;
        
        const roots = menus.rows.filter(m => !m.parent_id);
        const rootValues = roots.map(m => {
            const label = m.label.replace(/'/g, "''");
            const icon = m.icon ? `'${m.icon}'` : 'NULL';
            const perm = m.permission_code ? `'${m.permission_code}'` : 'NULL';
            return `('${m.id}', '${label}', '${m.url}', '${m.key}', '${m.module_key}', ${icon}, ${m.sort_order}, ${m.is_global}, ${perm}, '${m.created_at.toISOString()}', '${m.updated_at.toISOString()}')`;
        }).join(',\n');

        sql += rootValues + ';\n\n';

        sql += `-- 4. INSERT MASTER SUB-MENUS\n`;
        sql += `INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code, created_at, updated_at) VALUES \n`;
        
        const children = menus.rows.filter(m => m.parent_id);
        const childValues = children.map(m => {
            const label = m.label.replace(/'/g, "''");
            const icon = m.icon ? `'${m.icon}'` : 'NULL';
            const perm = m.permission_code ? `'${m.permission_code}'` : 'NULL';
            return `('${m.id}', '${label}', '${m.url}', '${m.key}', '${m.module_key}', ${icon}, '${m.parent_id}', ${m.sort_order}, ${m.is_global}, ${perm}, '${m.created_at.toISOString()}', '${m.updated_at.toISOString()}')`;
        }).join(',\n');

        sql += childValues + ';\n\n';

        sql += `-- 5. ENABLE INVENTORY FOR ALL TENANTS\n`;
        sql += `INSERT INTO tenant_module (id, tenant_id, module_key, enabled, created_at, updated_at) 
SELECT gen_random_uuid(), id, 'inventory', true, now(), now() FROM tenant 
ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = true;`;

        fs.writeFileSync('PGADMIN_RECOVER_MENUS.sql', sql);
        console.log("🏁 SUCCESS! Copy the content of PGADMIN_RECOVER_MENUS.sql to pgAdmin.");
    } catch (e) {
        console.error("❌ SQL Generation Error:", e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
