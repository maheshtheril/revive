import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateUniversalPDF } from "@/lib/pdf/universal-engine";
import { getCurrentCompany } from "@/app/actions/company";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const session = await auth();
        
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 1. Fetch Comprehensive Invoice Data
        console.log(`[PRINTER] Fetching Invoice ID: ${id}`);
        const invoice = await prisma.hms_invoice.findUnique({
            where: { id: id },
            include: {
                hms_patient: true,
                hms_invoice_lines: { include: { hms_product: true } }
            }
        });

        if (!invoice) {
            console.error(`[PRINTER] Error 404 - Invoice not found for ID: ${id}`);
            return new NextResponse(`Invoice not found for ID: ${id}`, { status: 404 });
        }

        console.log(`[PRINTER] Invoice found! Company ID is: ${invoice.company_id}`);
        let companyData = await getCurrentCompany();
        if (!companyData) {
            companyData = await prisma.company.findUnique({
                where: { id: invoice.company_id }
            });
            // Final failsafe: If the database is corrupted and the company doesn't exist, just grab the primary hospital company!
            if (!companyData) {
                console.log(`[PRINTER] Failsafe triggered. Invoice company missing, assigning default primary hospital.`);
                companyData = await prisma.company.findFirst({
                    orderBy: { created_at: 'asc' }
                });
                
                if (!companyData) {
                     return new NextResponse(`CRITICAL: Entire company table is empty. The hospital doesn't exist!`, { status: 404 });
                }
            }
        }
        console.log(`[PRINTER] All data resolved. Handing over to UniversalEngine...`);

        const autoPrint = request.nextUrl.searchParams.get('autoPrint') === 'true';

        // Total mapping for engine placeholders
        if (invoice) (invoice as any).total_amount = Number(invoice.total || 0).toFixed(2);

        // 2. GENERATE WORLD-CLASS PDF (Universal Engine)
        const pdfBase64 = await generateUniversalPDF(
            'sale_bill',
            invoice,
            companyData,
            invoice.branch_id || session.user.current_branch_id as string,
            autoPrint
        );
        
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Invoice_${invoice.id}.pdf"`,
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error: any) {
        console.error("[PRINTER-API] Error:", error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
