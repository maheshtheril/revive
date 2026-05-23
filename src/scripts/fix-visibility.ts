import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
    console.log("SURGICAL FIX: Restoring OP Slip Visibility...");
    
    // Find all OP Slip templates
    const templates = await prisma.hms_print_template.findMany({
        where: { usage: 'op_slip' }
    });

    for (const t of templates) {
        const config = t.config as any;
        if (config && config.coordinates) {
            console.log(`Fixing visibility for template: ${t.name} (${t.id})`);
            
            // Critical Fields that MUST be visible
            const criticalFields = ['logo', 'name', 'token', 'patientName', 'doctor', 'address', 'docTitle', 'docDate'];
            
            for (const field of criticalFields) {
                if (config.coordinates[field]) {
                    config.coordinates[field].showSection = true;
                }
            }
            
            await prisma.hms_print_template.update({
                where: { id: t.id },
                data: { config: config }
            });
        }
    }
    
    console.log("SUCCESS: All OP Slip templates are now visible.");
}

fix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
