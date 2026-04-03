const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db'
  });

  try {
    await client.connect();
    console.log('Auditing Database Schema for Identity Fields...');

    const res = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('hms_clinicians', 'hms_staff') ORDER BY table_name, ordinal_position");
    
    const tables = {};
    for (const row of res.rows) {
        if (!tables[row.table_name]) tables[row.table_name] = [];
        tables[row.table_name].push(row.column_name);
    }
    
    console.log('Schema Audit Results:', JSON.stringify(tables, null, 2));

  } catch (err) {
    console.error('AUDIT FAILED:', err);
  } finally {
    await client.end();
  }
}

main();
