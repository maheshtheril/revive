import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// ONE-SHOT CLEANUP ENDPOINT
// Purges duplicate print templates, keeping only the most recently updated
// one per (name, usage, company_id, tenant_id) group.
// DELETE this file after running once.
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.isAdmin) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        // Find all templates
        const all = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, name, usage, company_id, tenant_id, is_default, updated_at
            FROM hms_print_template
            ORDER BY name, usage, company_id, tenant_id, is_default DESC, updated_at DESC
        `);

        // Group by (name, usage, company_id, tenant_id)
        const groups = new Map<string, any[]>();
        for (const row of all) {
            const key = `${(row.name || '').trim().toLowerCase()}||${row.usage}||${row.company_id}||${row.tenant_id}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row);
        }

        const toDelete: string[] = [];
        const kept: any[] = [];

        for (const [key, rows] of groups.entries()) {
            if (rows.length <= 1) {
                kept.push({ key, id: rows[0].id, kept: 'only' });
                continue;
            }
            // Keep the is_default=true one, or newest, kill the rest
            const winner = rows[0]; // already sorted: is_default DESC, updated_at DESC
            kept.push({ key, id: winner.id, kept: 'winner', duplicatesRemoved: rows.length - 1 });
            for (let i = 1; i < rows.length; i++) {
                toDelete.push(rows[i].id);
            }
        }

        let deleted = 0;
        if (toDelete.length > 0) {
            // Delete in batches to avoid massive IN clauses
            for (let i = 0; i < toDelete.length; i += 100) {
                const batch = toDelete.slice(i, i + 100);
                const placeholders = batch.map((_, idx) => `$${idx + 1}::uuid`).join(', ');
                await prisma.$executeRawUnsafe(
                    `DELETE FROM hms_print_template WHERE id IN (${placeholders})`,
                    ...batch
                );
                deleted += batch.length;
            }
        }

        return NextResponse.json({
            success: true,
            totalBefore: all.length,
            deletedPhantoms: deleted,
            keptGroups: kept.filter(k => k.duplicatesRemoved > 0),
            message: deleted === 0 
                ? "DB is clean — no duplicates found." 
                : `Purged ${deleted} phantom template(s).`
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
