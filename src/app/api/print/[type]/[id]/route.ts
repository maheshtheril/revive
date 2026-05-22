import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUniversalPDF, PDFUsage } from "@/lib/pdf/universal-engine";
import { getCurrentCompany } from "@/app/actions/company";
import { ensureAppointmentToken } from "@/app/actions/appointment";

export async function GET(
    req: NextRequest, 
    { params }: { params: Promise<{ type: string; id: string }> }
) {
    try {
        const { type, id } = await params;
        const session = await auth();
        if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const companyData = await getCurrentCompany();
        if (!companyData) return new NextResponse("Company configuration not found", { status: 404 });

        // 1. RESOLVE USAGE
        let usage: PDFUsage = 'sale_bill';
        if (type === 'prescription') usage = 'prescription';
        else if (type === 'appointment' || type === 'op_slip') usage = 'op_slip';
        else if (type === 'lab_report') usage = 'lab_report';

        // 2. FETCH COMPREHENSIVE DATA
        let data: any = null;
        if (usage === 'op_slip') {
            // [ELITE-GUARD] Auto-generate token if missing before printing
            const tokenRes = await ensureAppointmentToken(id);
            if (tokenRes.success) data = tokenRes.data;

            if (!data) {
                data = await prisma.hms_appointments.findFirst({ 
                    where: { id }, 
                    include: { hms_patient: true, hms_clinician: true } 
                });
            }
        } else if (usage === 'prescription') {
            data = await prisma.hms_appointments.findFirst({
                where: { id },
                include: { 
                    hms_patient: true, 
                    hms_clinician: true,
                    prescription: { include: { medicines: true } }
                }
            });
            // Flatten for engine
            if (data?.prescription?.[0]) {
                data.medicines = data.prescription[0].medicines;
            }
        } else if (usage === 'lab_report') {
            data = await prisma.hms_lab_order.findFirst({
                where: { id },
                include: {
                    hms_patient: true,
                    hms_lab_order_line: {
                        include: { hms_lab_test: true }
                    }
                }
            });
        } else if (usage === 'sale_bill') {
            data = await prisma.hms_invoice.findFirst({ 
                where: { id }, 
                include: { 
                    hms_patient: true, 
                    hms_invoice_lines: { include: { hms_product: true } },
                    hms_appointment: {
                        include: { hms_clinician: true }
                    }
                }
            });
            // Total mapping for engine placeholders
            if (data) data.total_amount = Number(data.total || 0).toFixed(2);
        }

        if (!data) return new NextResponse("Document Data Not Found", { status: 404 });

        const autoPrint = req.nextUrl.searchParams.get('autoPrint') === 'true';

        // 3. GENERATE WORLD-CLASS PDF
        const pdfBase64 = await generateUniversalPDF(
            usage,
            data,
            companyData,
            data.branch_id || session.user.branchId as string,
            autoPrint
        );

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${usage}_${id}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        console.error("[API_PRINT_FAIL]", error);
        return new NextResponse(`Print Engine Failure: ${error.message}`, { status: 500 });
    }
}
