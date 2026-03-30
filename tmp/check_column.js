const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'hms_clinicians' 
    AND column_name = 'document_urls'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

check().catch(console.error);
