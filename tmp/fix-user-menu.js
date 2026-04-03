const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db'
  });

  try {
    await client.connect();
    console.log('Connected to local hms_db. Fixing Duplicate User Menus...');

    // 1. Audit User-Related Menus in Settings (module_key: 'configuration')
    const res = await client.query("SELECT id, label, key FROM menu_items WHERE label ILIKE '%Users%' AND module_key = 'configuration'");
    
    if (res.rows.length <= 1) {
        console.log('No Duplicate User Menus found in Settings.');
        process.exit(0);
    }

    console.log(`Found ${res.rows.length} User-related menus. Reconciling...`);
    
    // 2. Identify the primary 'settings-users' link to keep
    const keepRecord = res.rows.find(r => r.key === 'settings-users') || res.rows[0];
    const keepId = keepRecord.id;
    
    console.log(`Keeping Menu: ${keepRecord.label} (Key: ${keepRecord.key}, ID: ${keepId})`);
    
    // 3. Purge the others
    const deleteIds = res.rows.filter(r => r.id !== keepId).map(r => r.id);
    await client.query("DELETE FROM menu_items WHERE id = ANY($1)", [deleteIds]);

    console.log('SUCCESS: Duplicate User menus purged from Configuration.');

  } catch (err) {
    console.error('FIX FAILED:', err);
  } finally {
    await client.end();
  }
}

main();
