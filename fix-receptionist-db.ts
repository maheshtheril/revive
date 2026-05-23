import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fixing ALL Receptionist permissions directly in the DB...");
    
    const roles = await prisma.role.findMany({
        where: { key: 'receptionist' }
    });
    
    console.log(`Found ${roles.length} receptionist roles.`);
    
    const allowed = ['hms:view', 'hms:dashboard:reception'];
    
    for (const role of roles) {
        // Delete all existing permissions for the receptionist
        await prisma.role_permission.deleteMany({
            where: { role_id: role.id }
        });
        
        // Insert only the strictly allowed permissions
        for (const code of allowed) {
            await prisma.role_permission.create({
                data: {
                    role_id: role.id,
                    permission_code: code,
                    is_granted: true
                }
            });
        }
        
        // Update the array field
        await prisma.role.update({
            where: { id: role.id },
            data: { permissions: allowed }
        });
    }
    
    console.log("All Receptionist permissions strictly locked to:", allowed);
}

main().catch(console.error).finally(() => prisma.$disconnect());
