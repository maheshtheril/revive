const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT a.pid, l.locktype, l.mode, l.granted, a.query 
    FROM pg_locks l 
    JOIN pg_stat_activity a ON l.pid = a.pid
    WHERE a.wait_event_type = 'Lock';
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

check().catch(console.error);
