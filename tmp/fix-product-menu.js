const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db'
  });

  try {
    await client.connect();
    console.log('Connected to local hms_db. Fixing Product Menu...');

    // 1. Ensure the WAREHOUSE parent exists
    const warehouseRes = await client.query("SELECT id FROM menu_items WHERE key = 'inv-warehouse'");
    if (warehouseRes.rows.length === 0) {
        console.error('CRITICAL: inv-warehouse parent category not found.');
        process.exit(1);
    }
    const warehouseId = warehouseRes.rows[0].id;

    // 2. Locate the Product Master link
    // We search by key 'inv-products' or label 'Product Master'
    const productRes = await client.query("SELECT id FROM menu_items WHERE key = 'inv-products' OR label ILIKE '%Product Master%'");
    
    if (productRes.rows.length > 0) {
        const productId = productRes.rows[0].id;
        console.log(`Found Product Master (ID: ${productId}). Moving to WAREHOUSE...`);
        await client.query("UPDATE menu_items SET parent_id = $1, module_key = 'inventory' WHERE id = $2", [warehouseId, productId]);
    } else {
        console.log('Product Master link not found. Re-creating it...');
        await client.query(`
            INSERT INTO menu_items (id, label, key, module_key, icon, sort_order, is_global, url, parent_id)
            VALUES (gen_random_uuid(), 'Product Master', 'inv-products', 'inventory', 'Package', 10, true, '/hms/inventory/products', $1)
        `, [warehouseId]);
    }

    console.log('SUCCESS: Product Master restored to INVENTORY -> WAREHOUSE / STOCK.');

  } catch (err) {
    console.error('FIX FAILED:', err);
  } finally {
    await client.end();
  }
}

main();
