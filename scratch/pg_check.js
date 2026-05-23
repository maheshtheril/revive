const { Client } = require('pg');
const connectionString = "postgresql://postgres:hms2035@localhost:5432/hms_db";

async function check() {
    console.log("--- PG HEALTH CHECK ---");
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to PG.");
        
        const resTenants = await client.query('SELECT COUNT(*) FROM tenant');
        console.log(`Tenants: ${resTenants.rows[0].count}`);
        
        const tenants = await client.query('SELECT slug, domain, app_url FROM tenant');
        console.log("Tenants detail:", JSON.stringify(tenants.rows, null, 2));
        
        const resUsers = await client.query('SELECT COUNT(*) FROM app_user');
        console.log(`Users: ${resUsers.rows[0].count}`);
        
        const activeUsers = await client.query('SELECT email, role, is_active FROM app_user WHERE is_active = true');
        console.log("Active Users:", JSON.stringify(activeUsers.rows, null, 2));
        
    } catch (e) {
        console.error("PG CHECK FAILED:", e.message);
    } finally {
        await client.end();
    }
}

check();
