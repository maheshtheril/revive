import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

// Runs the print template repair migration directly via Prisma raw SQL.
// Safe to run multiple times (idempotent).
export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: string[] = [];
    const errors: string[] = [];

    try {
        // Step 1: Fill in any existing NULL company_ids
        const filled = await prisma.$executeRawUnsafe(`
            UPDATE hms_print_template t
            SET company_id = (
                SELECT c.id FROM company c WHERE c.tenant_id = t.tenant_id LIMIT 1
            )
            WHERE t.company_id IS NULL
        `);
        results.push(`Filled ${filled} NULL company_id rows.`);
    } catch (e: any) { errors.push(`Fill nulls: ${e.message}`); }

    try {
        // Step 2: Purge duplicates - keep the most recently updated per group
        const purged = await prisma.$executeRawUnsafe(`
            DELETE FROM hms_print_template a
            USING hms_print_template b
            WHERE a.tenant_id   = b.tenant_id
              AND a.company_id  = b.company_id
              AND lower(a.name) = lower(b.name)
              AND a.usage       = b.usage
              AND a.id          <> b.id
              AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id))
        `);
        results.push(`Purged ${purged} duplicate rows.`);
    } catch (e: any) { errors.push(`Purge duplicates: ${e.message}`); }

    try {
        // Step 3: Drop old constraint
        await prisma.$executeRawUnsafe(`
            ALTER TABLE hms_print_template
                DROP CONSTRAINT IF EXISTS uq_hms_print_template_branch_lock
        `);
        results.push(`Dropped old constraint.`);
    } catch (e: any) { errors.push(`Drop constraint: ${e.message}`); }

    try {
        // Step 4: Make company_id NOT NULL
        await prisma.$executeRawUnsafe(`
            ALTER TABLE hms_print_template
                ALTER COLUMN company_id SET NOT NULL
        `);
        results.push(`Set company_id NOT NULL.`);
    } catch (e: any) { 
        // This may fail if nullable values still exist; that's OK if step 1 ran
        errors.push(`Set NOT NULL (may be ok): ${e.message}`);
    }

    try {
        // Step 5: Re-add constraint
        await prisma.$executeRawUnsafe(`
            ALTER TABLE hms_print_template
                ADD CONSTRAINT uq_hms_print_template_branch_lock
                UNIQUE (tenant_id, company_id, name, usage)
        `);
        results.push(`Unique constraint restored.`);
    } catch (e: any) {
        // Might already exist
        errors.push(`Add constraint (may already exist): ${e.message}`);
    }

    // Final count
    const remaining = await prisma.$queryRawUnsafe<{cnt: bigint}[]>(`
        SELECT count(*) as cnt FROM hms_print_template
    `);

    return NextResponse.json({
        success: errors.length === 0,
        results,
        errors,
        totalTemplates: Number(remaining[0]?.cnt ?? 0),
        message: errors.length === 0 
            ? '✅ Database is now clean. ON CONFLICT will work correctly on all future saves.'
            : '⚠️ Partial success. Review errors above.'
    });
}
