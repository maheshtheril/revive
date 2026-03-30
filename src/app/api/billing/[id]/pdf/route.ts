import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInvoicePDFBase64 } from "@/lib/utils/pdf-generator";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = await params;
        const autoPrint = request.nextUrl.searchParams.get('autoPrint') === 'true';

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
        console.error("[PDF-API] Error generating invoice PDF:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
