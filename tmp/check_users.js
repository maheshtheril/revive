const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT id, email, name, role FROM app_user LIMIT 5;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

check().catch(console.error);
