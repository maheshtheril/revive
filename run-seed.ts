import { prisma } from './src/lib/prisma';
import { seedRolesAndPermissions } from './src/app/actions/rbac';

async function main() {
    console.log("Running RBAC seed to sync code changes to database...");
    
    // We need to pass a valid tenant ID to the seed function
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.log("No tenant found!");
        return;
    }
    
    await seedRolesAndPermissions(tenant.id);
    console.log("Seed completed. Roles should now reflect the strict code definitions.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
