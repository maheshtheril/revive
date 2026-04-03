const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db'
  });

  try {
    await client.connect();
    console.log('Connected to local hms_db. Starting Universal Identity Audit...');

    // --- 1. Audit app_user (Logins) ---
    console.log('Checking app_user duplicates...');
    const userDuplicates = await client.query("SELECT LOWER(email) as lower_email, count(*) FROM app_user GROUP BY LOWER(email) HAVING count(*) > 1");
    for (const row of userDuplicates.rows) {
        console.log(`- Found ${row.count} records for email: ${row.lower_email}. Reconciling...`);
        const res = await client.query("SELECT id, is_active FROM app_user WHERE LOWER(email) = $1 ORDER BY is_active DESC, created_at ASC", [row.lower_email]);
        const primaryId = res.rows[0].id;
        const dupIds = res.rows.slice(1).map(r => r.id);
        await client.query("DELETE FROM app_user WHERE id = ANY($1)", [dupIds]);
    }

    // --- 2. Audit hms_clinicians (Doctors) ---
    console.log('Checking hms_clinicians duplicates...');
    const clinDuplicates = await client.query("SELECT first_name, last_name, count(*) FROM hms_clinicians GROUP BY first_name, last_name HAVING count(*) > 1");
    for (const row of clinDuplicates.rows) {
        console.log(`- Found ${row.count} records for clinician: ${row.first_name} ${row.last_name}. Reconciling...`);
        const res = await client.query("SELECT id FROM hms_clinicians WHERE first_name = $1 AND last_name = $2 ORDER BY created_at ASC", [row.first_name, row.last_name]);
        const primaryId = res.rows[0].id;
        const dupIds = res.rows.slice(1).map(r => r.id);
        await client.query("DELETE FROM hms_clinicians WHERE id = ANY($1)", [dupIds]);
    }

    // --- 3. Audit hms_staff (Staff/Nurses) ---
    console.log('Checking hms_staff duplicates...');
    // HMS Staff uses 'name' column instead of first/last
    const staffDuplicates = await client.query("SELECT name, count(*) FROM hms_staff GROUP BY name HAVING count(*) > 1");
    for (const row of staffDuplicates.rows) {
        console.log(`- Found ${row.count} records for staff: ${row.name}. Reconciling...`);
        const res = await client.query("SELECT id FROM hms_staff WHERE name = $1 ORDER BY created_at ASC", [row.name]);
        const primaryId = res.rows[0].id;
        const dupIds = res.rows.slice(1).map(r => r.id);
        await client.query("DELETE FROM hms_staff WHERE id = ANY($1)", [dupIds]);
    }

    console.log('GLOBAL IDENTITY DEDUPLICATION SUCCESSFUL.');

  } catch (err) {
    console.error('DEDUPLICATION FAILED:', err);
  } finally {
    await client.end();
  }
}

main();
