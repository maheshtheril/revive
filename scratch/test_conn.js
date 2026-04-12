const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_LKIg3tRXfbp9@ep-flat-firefly-a19fhxoa.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function test() {
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected Successfully!");
    const res = await client.query('SELECT NOW()');
    console.log("Current Time:", res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error("Connection Failed:", err);
  }
}

test();
