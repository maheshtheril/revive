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

        // 1. Fetch Comprehensive Sales Return Data
        console.log(`[PRINTER] Fetching Return ID: ${id}`);
        const sReturn = await prisma.hms_sales_return.findUnique({
            where: { id: id },
            include: {
                hms_patient: true,
                lines: { include: { hms_product: true } },
                hms_invoice: true
            }
        });

        const pReturn = !sReturn ? await prisma.hms_purchase_return.findUnique({
            where: { id: id },
            include: {
                hms_supplier: true,
                lines: { include: { hms_product: true } }
            }
        }) : null;

        if (!sReturn && !pReturn) {
            console.error(`[PRINTER] Error 404 - Return not found for ID: ${id}`);
            return new NextResponse(`Return not found for ID: ${id}`, { status: 404 });
        }

        const activeReturn = sReturn || pReturn;
        const usageType = sReturn ? 'sales_return' : 'purchase_return';
        const docPrefix = sReturn ? 'CreditNote_' : 'DebitNote_';

        console.log(`[PRINTER] Return found (${usageType})! Company ID is: ${activeReturn!.company_id}`);
        let companyData = await getCurrentCompany();
        if (!companyData) {
            companyData = await prisma.company.findUnique({
                where: { id: activeReturn!.company_id }
            });
            
            if (!companyData) {
                companyData = await prisma.company.findFirst({
                    orderBy: { created_at: 'asc' }
                });
            }
        }

        const autoPrint = request.nextUrl.searchParams.get('autoPrint') === 'true';

        const printData = {
            ...activeReturn,
            id: activeReturn!.id,
            return_number: activeReturn!.return_number,
            total_amount: Number(activeReturn!.total_amount || 0).toFixed(2),
            patient_name: sReturn ? `${sReturn.hms_patient?.first_name || ''} ${sReturn.hms_patient?.last_name || ''}`.trim() : (pReturn?.hms_supplier?.name || "Vendor / Supplier"),
            patient_phone: sReturn ? (sReturn.hms_patient?.phone || "N/A") : (pReturn?.hms_supplier?.phone || "N/A"),
            items: activeReturn!.lines.map(l => ({
                ...l,
                description: (l as any).hms_product?.name || "Returned Item",
                quantity: Number(l.qty),
                unit_price: Number(l.unit_price),
                net_amount: Number(l.line_total)
            })),
            created_at: activeReturn!.created_at
        };

        // 2. GENERATE WORLD-CLASS PDF (Universal Engine)
        const pdfBase64 = await generateUniversalPDF(
            usageType as any,
            printData,
            companyData,
            session.user.current_branch_id as string,
            autoPrint
        );
        
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${docPrefix}${activeReturn!.return_number}.pdf"`,
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error: any) {
        console.error("[RETURN-PRINTER-API] Error:", error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
