import { prisma } from './src/lib/prisma';

async function main() {
    const role = await prisma.role.findFirst({
        where: { key: 'receptionist' },
        include: { role_permission: true }
    });
    
    if (!role) {
        console.log("No receptionist role found in `role` table.");
        return;
    }
    
    console.log("Role:", role.name);
    console.log("Array Permissions:", role.permissions);
    console.log("Table Permissions:", role.role_permission.filter(rp => rp.is_granted).map(rp => rp.permission_code));
}

main().catch(console.error).finally(() => prisma.$disconnect());
