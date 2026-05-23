import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fixing users that were created without a password but are marked as active...");
    const result = await prisma.$executeRaw`
        UPDATE app_user 
        SET is_active = false
        WHERE password IS NULL AND is_active = true
    `;
    console.log("Fixed users:", result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
