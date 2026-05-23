import { prisma } from './src/lib/prisma';

async function checkOrigin() {
    const user = await prisma.app_user.findFirst({
        where: { email: 'recep@live.com' }
    });
    
    const userRoles = await prisma.user_role.findMany({
        where: { user_id: user.id }
    });
    
    console.log("User Roles associated with this user:");
    for (const ur of userRoles) {
        const role = await prisma.role.findUnique({ where: { id: ur.role_id }});
        console.log("  -", role?.name, "key:", role?.key);
        console.log("    Permissions array:", role?.permissions);
    }
    
    const userPerms = await prisma.user_permission.findMany({
        where: { user_id: user.id }
    });
    
    console.log("User specific permissions:", userPerms.map(up => up.permission_code));
}

checkOrigin().catch(console.error).finally(() => prisma.$disconnect());
