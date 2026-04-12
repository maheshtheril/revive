
import { prisma } from '../src/lib/prisma'

async function run() {
    try {
        const roles = await prisma.hms_roles.findMany();
        console.log('--- SYSTEM ROLES ---')
        console.table(roles)
        
        const permissions = await prisma.hms_permissions.findMany({
            take: 20
        });
        console.log('--- SAMPLE PERMISSIONS ---')
        console.table(permissions)
        
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
run()
