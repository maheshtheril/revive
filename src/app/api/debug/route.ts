import { NextResponse } from 'next/server';
import { getPDFConfig } from '@/app/actions/settings';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const tenantId = searchParams.get('tenantId');
    
    // Fall back to known active user to test
    const finalCompanyId = companyId || 'cm0ebz0p20000r57c8gq4szq0';
    const finalTenantId = tenantId || 'cm0ebyqbx0000x2vccz9qsz1d'; // Using a placeholder

    // We can't rely on auth() for API routes without a session, but companyId and tenantId can test getPDFSettings
    try {
        const config = await getPDFConfig(finalCompanyId, finalTenantId, 'op_slip');
        return NextResponse.json({ success: true, config });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
