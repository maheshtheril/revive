import { prisma } from './src/lib/prisma';
import { getMenuItems } from './src/app/actions/navigation';

// Mock auth module
jest.mock('./src/auth', () => ({
    auth: async () => {
        const user = await prisma.app_user.findFirst({ where: { email: 'reception1@hospital.com' } });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenant_id
            }
        };
    }
}));

async function main() {
    const items = await getMenuItems();
    console.log(JSON.stringify(items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
