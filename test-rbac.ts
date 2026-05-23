import { prisma } from './src/lib/prisma';
import { getMenuItems } from './src/app/actions/navigation';
import { auth } from './src/auth';

// We will mock auth by overriding it
jest.mock('./src/auth', () => ({
    auth: async () => {
        return {
            user: {
                id: "7d17d6fd-f29a-474d-a9a4-87db985681be", // From previous log
                email: 'reception1@hospital.com',
                name: 'Receptionist One',
                role: 'Receptionist',
                tenantId: '00000000-0000-0000-0000-000000000001'
            }
        };
    }
}));

async function main() {
    const items = await getMenuItems();
    console.log(JSON.stringify(items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
