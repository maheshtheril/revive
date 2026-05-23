
import { prisma } from './src/lib/prisma.ts';

async function main() {
  try {
    const tenantId = '04782658-9e3c-4d3d-b722-ce905a91c520';
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { created_at: true, name: true }
    });
    console.log(`CURRENT_TENANT: ${tenant?.name} created at ${tenant?.created_at?.toISOString()}`);
    
    const oldTenantId = '41537389-7316-4a86-97a3-de21ff9833f7';
    const oldTenant = await prisma.tenant.findUnique({
        where: { id: oldTenantId },
        select: { created_at: true, name: true }
    });
    console.log(`OLD_TENANT: ${oldTenant?.name} created at ${oldTenant?.created_at?.toISOString()}`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
