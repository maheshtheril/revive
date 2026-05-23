import { prisma } from './src/lib/prisma';

async function testPermissions() {
    const user = await prisma.app_user.findFirst({
        where: { email: 'recep@live.com' }
    });
    
    if (!user) {
        console.log("User not found");
        return;
    }
    
    console.log("User:", user.email, "role:", user.role, "tenant_admin:", user.is_tenant_admin);
    
    const permissionSet = new Set<string>();
    const tenantId = user.tenant_id;
    const userId = user.id;

    const userRoles = await prisma.user_role.findMany({
        where: { user_id: userId, tenant_id: tenantId }
    });
    const roleIds = userRoles.map(ur => ur.role_id);

    if (user.role) {
        const legacyRole = await prisma.role.findFirst({
            where: {
                tenant_id: tenantId,
                key: user.role.toLowerCase()
            }
        });
        if (legacyRole) {
            roleIds.push(legacyRole.id);
        }
    }

    if (roleIds.length > 0) {
        const roles = await prisma.role.findMany({
            where: { id: { in: roleIds } }
        });
        roles.forEach(r => {
            if (Array.isArray(r.permissions)) {
                r.permissions.forEach((p: string) => permissionSet.add(p));
            }
        });
        const rolePermissions = await prisma.role_permission.findMany({
            where: { role_id: { in: roleIds }, is_granted: true }
        });
        rolePermissions.forEach(rp => permissionSet.add(rp.permission_code));
    }

    const userPermissions = await prisma.user_permission.findMany({
        where: { user_id: userId, tenant_id: tenantId, is_granted: true }
    });
    userPermissions.forEach(up => permissionSet.add(up.permission_code));

    if (user.is_admin || user.is_tenant_admin) {
        permissionSet.add('*');
    }

    // IF userPerms is still 0, fallback:
    if (permissionSet.size === 0) {
         console.log("Size 0, fallback logic would run!");
    }

    console.log("Final permissions:", Array.from(permissionSet));
}

testPermissions().catch(console.error).finally(() => prisma.$disconnect());
