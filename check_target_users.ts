
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const tenantId = '41537389-7316-4a86-97a3-de21ff9833f7';
    const users = await prisma.app_user.findMany({
        where: { tenant_id: tenantId },
        select: { email: true, name: true }
    });
    console.log(`USERS_OF_TARGET_TENANT:`);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
