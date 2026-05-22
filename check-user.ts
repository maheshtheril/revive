import { prisma } from './src/lib/prisma';

async function main() {
    const user = await prisma.app_user.findFirst({
        orderBy: { created_at: 'desc' }
    });
    console.log("Latest user:", user?.email);
    console.log("is_active:", user?.is_active);
    console.log("password exists?", !!user?.password);
}

main().catch(console.error).finally(() => prisma.$disconnect());
