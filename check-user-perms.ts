import { prisma } from './src/lib/prisma';
import { getUserPermissions } from './src/app/actions/rbac';

async function main() {
    const user = await prisma.app_user.findFirst({
        orderBy: { created_at: 'desc' },
        include: { hms_user_roles: { include: { hms_role: true } } }
    });
    
    if (!user) {
        console.log("No user found.");
        return;
    }
    
    console.log("Latest user:", user.email);
    console.log("is_tenant_admin:", user.is_tenant_admin);
    console.log("is_admin:", user.is_admin);
    console.log("System Role:", user.role);
    console.log("HMS Roles:", user.hms_user_roles.map(r => r.hms_role.name));
    
    const perms = await getUserPermissions(user.id);
    console.log("Resolved Permissions:", perms);
}

main().catch(console.error).finally(() => prisma.$disconnect());
