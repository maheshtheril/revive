const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    console.error('.env not found');
    process.exit(1);
}

const localDb = process.env.DATABASE_URL;
const cloudDb = process.env.CLOUD_DATABASE_URL;

async function checkDb(name, connStr) {
    console.log(`\n================= ${name} =================`);
    const client = new Client({
        connectionString: connStr,
        ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // Check current database and schema
        const currentDb = await client.query('SELECT current_database(), current_schema()');
        const searchPath = await client.query('SHOW search_path');
        console.log(`Current DB: ${currentDb.rows[0].current_database}, Current Schema: ${currentDb.rows[0].current_schema}, search_path: ${searchPath.rows[0].search_path}`);

        // Fix search_path by altering role and database settings
        if (name === 'CLOUD DB') {
            console.log('Fixing CLOUD DB search_path config...');
            await client.query('ALTER DATABASE neondb SET search_path TO "$user", public');
            await client.query('ALTER ROLE neondb_owner SET search_path TO "$user", public');
            console.log('[SUCCESS] Configured search_path permanently on Cloud DB.');
        }

        // List schemas
        const schemasRes = await client.query('SELECT schema_name FROM information_schema.schemata');
        console.log('Schemas available:', schemasRes.rows.map(r => r.schema_name).join(', '));

        // Check if hms_patient table exists in any schema
        const tableCheck = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'hms_patient'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log(`[FOUND] hms_patient table exists:`, tableCheck.rows);
            // Print table row count if exists
            const countRes = await client.query(`SELECT count(*) FROM "${tableCheck.rows[0].table_schema}".hms_patient`);
            console.log(`Row count: ${countRes.rows[0].count}`);
        } else {
            console.log(`[NOT FOUND] hms_patient table does NOT exist in any schema.`);
            
            // List all tables in any user schema
            const tablesList = await client.query(`
                SELECT schemaname, tablename 
                FROM pg_tables 
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                LIMIT 20
            `);
            console.log('Available tables (up to 20):');
            tablesList.rows.forEach(r => console.log(` - ${r.schemaname}.${r.tablename}`));
        }

    } catch (err) {
        console.error(`Error with ${name}:`, err.message);
    } finally {
        await client.end();
    }
}

async function run() {
    await checkDb('LOCAL DB', localDb);
    await checkDb('CLOUD DB', cloudDb);
}

run();
