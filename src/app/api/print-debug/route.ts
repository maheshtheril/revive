import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || session.user.companyId;
    const tenantId = session.user.tenantId;

    try {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true, parent_id: true }
        });

        const parentId = company?.parent_id;

        const templates = await prisma.hms_print_template.findMany({
            where: {
                tenant_id: tenantId,
                OR: [
                    { company_id: companyId },
                    { company_id: parentId }
                ].filter(Boolean) as any
            },
            orderBy: { updated_at: 'desc' }
        });

        const configs = await prisma.hms_settings.findMany({
            where: {
                tenant_id: tenantId,
                key: { in: ['registration_config', 'pdf_print_config'] },
                OR: [
                    { company_id: companyId },
                    { company_id: parentId }
                ].filter(Boolean) as any
            }
        });

        return NextResponse.json({
            context: {
                companyId,
                tenantId,
                parentId,
                companyName: company?.name
            },
            modern_templates: templates.map(t => ({
                id: t.id,
                name: t.name,
                usage: t.usage,
                is_default: t.is_default,
                is_active: t.is_active,
                company_id: t.company_id
            })),
            config_records: configs.map(c => ({
                id: c.id,
                key: c.key,
                company_id: c.company_id,
                usageDefaults: (c.value as any)?.usageDefaults || 'NONE'
            }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
