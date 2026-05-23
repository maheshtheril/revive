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

const localDbUrl = process.env.DATABASE_URL;
const cloudDbUrl = process.env.CLOUD_DATABASE_URL;

async function getTableCounts(connStr, dbName) {
    const client = new Client({
        connectionString: connStr,
        ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    
    const counts = {};
    try {
        await client.connect();
        await client.query('SET search_path TO public');
        
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        for (const r of tablesRes.rows) {
            const tableName = r.table_name;
            try {
                const countRes = await client.query(`SELECT count(*) FROM "${tableName}"`);
                counts[tableName] = Number(countRes.rows[0].count);
            } catch (err) {
                // Ignore errors for system/temp tables if any
            }
        }
    } catch (err) {
        console.error(`Error fetching table counts from ${dbName}:`, err.message);
    } finally {
        await client.end();
    }
    return counts;
}

async function run() {
    console.log('Fetching local table counts...');
    const localCounts = await getTableCounts(localDbUrl, 'LOCAL DB');
    
    console.log('Fetching cloud table counts...');
    const cloudCounts = await getTableCounts(cloudDbUrl, 'CLOUD DB');
    
    console.log('\n=========================================');
    console.log('      DATABASE ROW COUNT COMPARISON');
    console.log('=========================================\n');
    
    const allTables = Array.from(new Set([...Object.keys(localCounts), ...Object.keys(cloudCounts)])).sort();
    
    console.log('| Table Name | Local Rows | Cloud Rows | Status |');
    console.log('|------------|------------|------------|--------|');
    
    let matchCount = 0;
    let mismatchCount = 0;
    
    for (const table of allTables) {
        const localVal = localCounts[table] !== undefined ? localCounts[table] : 'N/A';
        const cloudVal = cloudCounts[table] !== undefined ? cloudCounts[table] : 'N/A';
        
        let status = '';
        if (localVal === cloudVal) {
            status = '✅ Synced';
            matchCount++;
        } else {
            status = '❌ Mismatch';
            mismatchCount++;
        }
        
        console.log(`| ${table} | ${localVal} | ${cloudVal} | ${status} |`);
    }
    
    console.log(`\nSummary: ${matchCount} tables in sync, ${mismatchCount} tables mismatched.`);
}

run();
