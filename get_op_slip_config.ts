import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const templates = await prisma.hms_print_template.findMany({
        where: { usage: 'op_slip' },
        select: { id: true, name: true, config: true, is_active: true, tenant_id: true }
    });
    console.log("BRANDING STUDIO CUSTOM TEMPLATES FOR OP_SLIP: ", templates.length);
    console.dir(templates, { depth: null });
}
check().catch(console.error).finally(() => prisma.$disconnect());
