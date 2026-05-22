import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateUniversalPDF } from "@/lib/pdf/universal-engine";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    console.log(">>> [PDF-API-ENTRY] Hit the route handler");
    try {
        const params = await context.params;
        const id = params.id;
        
        const session = await auth();
        if (!session?.user?.tenantId) {
            console.warn(">>> [PDF-API] Unauthorized access attempt");
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const autoPrint = request.nextUrl.searchParams.get('autoPrint') === 'true';

        console.log(`[PDF-API] Attempting to generate PDF for ID: ${id} | Tenant: ${session.user.tenantId}`);

        const invoice = await prisma.hms_invoice.findUnique({
            where: {
                id: id,
                tenant_id: session.user.tenantId
            },
            include: {
                hms_patient: true,
                hms_invoice_lines: {
                    include: {
                        hms_product: true
                    }
                },
                hms_invoice_payments: true
            }
        });

        if (!invoice) {
            // DIAGNOSTIC PROBE: Check if ID exists AT ALL in any tenant
            const existsAnywhere = await prisma.hms_invoice.findUnique({ where: { id: id } });
            if (existsAnywhere) {
                console.error(`[PDF-API] SECURITY BLOCK: Invoice ${id} exists but belongs to tenant ${existsAnywhere.tenant_id}, not ${session.user.tenantId}`);
            } else {
                console.error(`[PDF-API] NOT FOUND: Invoice ${id} does not exist in the database.`);
            }
            return new NextResponse("Invoice not found", { status: 404 });
        }

        const company = await prisma.company.findUnique({
            where: { id: invoice.company_id }
        });

        const pdfBase64 = await generateUniversalPDF('sale_bill', invoice, company, invoice.branch_id || undefined, autoPrint);
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Invoice_${invoice.invoice_number}.pdf"`,
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error("[PDF-API] Error generating invoice PDF:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
