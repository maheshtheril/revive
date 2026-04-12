import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInvoicePDFBase64 } from "@/lib/utils/pdf-generator";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    console.log(">>> [PRINTER-API-ENTRY] Hit the dedicated printer route");
    try {
        const params = await context.params;
        const id = params.id;
        
        const session = await auth();
        if (!session?.user?.tenantId) {
            console.warn(">>> [PRINTER-API] Unauthorized access attempt");
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const autoPrint = request.nextUrl.searchParams.get('autoPrint') === 'true';

        console.log(`[PRINTER-API] Generating PDF for ID: ${id} | Tenant: ${session.user.tenantId}`);

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
            console.error(`[PRINTER-API] NOT FOUND: Invoice ${id} in tenant ${session.user.tenantId}`);
            return new NextResponse("Invoice not found", { status: 404 });
        }

        const company = await prisma.company.findUnique({
            where: { id: invoice.company_id }
        });

        const pdfBase64 = await generateInvoicePDFBase64(invoice, company, autoPrint);
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
        console.error("[PRINTER-API] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
