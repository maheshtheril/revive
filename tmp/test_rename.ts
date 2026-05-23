import { prisma } from '../src/lib/prisma';

async function simulateRename() {
    console.log("Testing rename issue...");
    // Grab any modern template ID
    const first = await prisma.hms_print_template.findFirst();
    if (!first) return console.log("No template found");

    console.log(`Original Name: ${first.name}`);

    const newName = first.name + " RENAME";

    try {
        const upsertedRows = await prisma.$queryRawUnsafe<{id: string}[]>(`
            INSERT INTO hms_print_template (
                id, tenant_id, company_id, name, usage, config, is_default, is_active, updated_by, updated_at, created_at, created_by
            ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8, $9::uuid, $10, $11, $12::uuid
            )
            ON CONFLICT (tenant_id, company_id, name, usage) 
            DO UPDATE SET 
                config = EXCLUDED.config,
                is_default = EXCLUDED.is_default
            RETURNING id
        `, 
            first.id, first.tenant_id, first.company_id, newName, first.usage, first.config, true, true, first.created_by, new Date(), new Date(), first.created_by
        );
        console.log("Success?", upsertedRows);
    } catch(e: any) {
        console.error("EXPECTED ERROR:", e.message);
    }
}
simulateRename().catch(console.error).finally(()=>process.exit(0));
