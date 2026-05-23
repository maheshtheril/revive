import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

async function testSave() {
    console.log("Testing save logic duplicating...");
    const tenantId = 'd5296614-a4ff-48ab-99b3-956d40462ffe';
    const companyId = 'd19cd294-cec2-43a8-a953-376938132323';
    const userId = '169ed55b-4029-43a4-8490-e7176461aeba';
    
    const name = "PROOF_TEST_1776350756483";
    const usage = "sale_bill";
    const configJson = JSON.stringify({ random: Math.random() });
    
    const existingRows = await prisma.$queryRawUnsafe<{id: string}[]>(`
        SELECT id FROM hms_print_template
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
          AND lower(name) = lower($3)
          AND usage = $4
        LIMIT 1
    `, tenantId, companyId, name, usage);

    const existingId = existingRows?.[0]?.id || null;
    const targetId = existingId || crypto.randomUUID();
    const now = new Date();

    const upsertedRows = await prisma.$queryRawUnsafe<{id: string}[]>(`
        INSERT INTO hms_print_template (
            id, tenant_id, company_id, name, usage, config, is_default, is_active, updated_by, updated_at, created_at, created_by
        ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8, $9::uuid, $10, $11, $12::uuid
        )
        ON CONFLICT (tenant_id, company_id, name, usage) 
        DO UPDATE SET 
            config = EXCLUDED.config,
            is_default = EXCLUDED.is_default,
            is_active = EXCLUDED.is_active,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at
        RETURNING id
    `, 
        targetId, tenantId, companyId, name, usage, configJson, true, true, userId, now, now, userId
    );

    console.log("Upserted:", upsertedRows);
    
    const count: any = await prisma.$queryRawUnsafe(`SELECT count(*) FROM hms_print_template WHERE lower(name) = lower($1)`, name);
    console.log("Count of this name:", count);
}

testSave().catch(console.error).finally(() => process.exit(0));
