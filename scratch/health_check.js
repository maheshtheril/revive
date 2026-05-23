const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log("--- HEALTH CHECK ---");
    try {
        const start = Date.now();
        console.log("Checking DB connectivity...");
        const count = await prisma.tenant.count();
        console.log(`DB OK. Found ${count} tenants. Time: ${Date.now() - start}ms`);
        
        const tenants = await prisma.tenant.findMany({ select: { slug: true, domain: true, app_url: true } });
        console.log("Tenants:", JSON.stringify(tenants, null, 2));
        
        const users = await prisma.app_user.count();
        console.log(`Users: ${users}`);
        
    } catch (e) {
        console.error("HEALTH CHECK FAILED:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
