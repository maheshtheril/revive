const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Manually find and load .env from root
const envPath = path.join(__dirname, '../.env');
let databaseUrl = 'postgresql://postgres:hms2035@localhost:5432/hms_db';

if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            const val = value.join('=').trim().replace(/^"(.*)"$/, '$1');
            const k = key.trim();
            process.env[k] = val;
            if (k === 'DATABASE_URL') databaseUrl = val;
            if (k === 'DIRECT_URL' && !process.env.DATABASE_URL) databaseUrl = val;
        }
    });
}

async function syncIp() {
    console.log('[DB-SYNC] Loading environment...');
    const newIp = process.argv[2];
    const port = process.argv[3] || '3002';
    
    if (!newIp) {
        console.error('No IP provided for sync');
        process.exit(1);
    }

    const appUrl = `http://${newIp}:${port}`;
    console.log(`[DB-SYNC] Syncing DB IP to: ${appUrl}`);
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // Update all tenants with both app_url and domain for fast resolution
        const res = await client.query('UPDATE "tenant" SET "app_url" = $1, "domain" = $2 RETURNING "slug", "app_url", "domain"', [appUrl, newIp]);
        
        if (res.rows.length > 0) {
            res.rows.forEach(row => {
                console.log(`[DB-SYNC] Updated Tenant ${row.slug} to URL: ${row.app_url} | Domain: ${row.domain}`);
            });
        } else {
            console.log('[DB-SYNC] No tenants found to update.');
        }
        
    } catch (e) {
        console.error('[DB-SYNC] Critical error updating IP in database:', e.message);
    } finally {
        await client.end();
    }
}

syncIp();
