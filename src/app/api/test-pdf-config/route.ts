import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPDFConfig } from '@/app/actions/settings';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const tenantId = url.searchParams.get('tenantId') || 'ziona';
        const companyId = url.searchParams.get('companyId');

        const company = await prisma.hms_companies.findFirst({
            where: { tenant_id: tenantId }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' });
        }

        const cid = companyId || company.id;

        const config = await getPDFConfig(cid, tenantId, 'op_slip');
        
        return NextResponse.json({
            tenantId,
            companyId: cid,
            success: true,
            config: config
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack });
    }
}
