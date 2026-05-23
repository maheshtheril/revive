const { Client } = require('pg');
require('dotenv').config();

async function testLocal() {
    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:hms2035@127.0.0.1:5432/postgres";
    console.log("Testing connection to:", dbUrl.replace(/:([^@]+)@/, ":****@"));
    
    const client = new Client({ 
        connectionString: dbUrl,
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log("SUCCESS: Connected to local PostgreSQL!");
        const res = await client.query('SELECT version()');
        console.log("Version:", res.rows[0].version);
    } catch (err) {
        console.error("CONNECTION FAILED:", err.message);
        if (err.message.includes('authentication')) {
            console.log("TIP: The password might be wrong.");
        } else if (err.message.includes('ECONNREFUSED')) {
            console.log("TIP: PostgreSQL service might be stopped.");
        }
    } finally {
        await client.end();
    }
}

testLocal();
