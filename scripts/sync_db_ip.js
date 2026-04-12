const fs = require('fs');
const path = require('path');

// Manually find and load .env from root
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncIp() {
    console.log('[DB-SYNC] Loading environment...');
    const newIp = process.argv[2];
    const port = process.argv[3] || '3002';
    
    if (!newIp || !process.env.DATABASE_URL) {
        console.error('No IP or DATABASE_URL provided for sync');
        process.exit(1);
    }

    const appUrl = `http://${newIp}:${port}`;
    console.log(`[DB-SYNC] Syncing DB IP to: ${appUrl}`);
    
    try {
        await prisma.$connect();
        
        // Update all tenants (in local mode, there's usually just one)
        const tenants = await prisma.tenant.findMany();
        
        for (const tenant of tenants) {
            await prisma.tenant.update({
                where: { id: tenant.id },
                data: { app_url: appUrl }
            });
            console.log(`[DB-SYNC] Updated Tenant ${tenant.slug} to ${appUrl}`);
        }
        
    } catch (e) {
        console.error('[DB-SYNC] Critical error updating IP in database:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

syncIp();
