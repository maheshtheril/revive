import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Forcing Receptionist role update in DB...");
    
    const legacyRole = await prisma.role.findFirst({
        where: { key: 'receptionist' }
    });

    if (legacyRole) {
        const correctPermissions = ['hms:view', 'hms:dashboard:reception'];
        
        await prisma.role.update({
            where: { id: legacyRole.id },
            data: { permissions: correctPermissions }
        });

        await prisma.role_permission.deleteMany({
            where: { role_id: legacyRole.id }
        });

        await prisma.role_permission.createMany({
            data: correctPermissions.map(p => ({
                role_id: legacyRole.id,
                permission_code: p,
                is_granted: true
            }))
        });

        console.log("Successfully updated DB for Receptionist.");
    } else {
        console.log("Legacy Receptionist role not found.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
