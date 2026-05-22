import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { getCurrentCompany } from "@/app/actions/company"
import { PrintPreviewHeader } from "@/components/print/print-preview-header"
import { 
    getPDFSettings, 
    getUnifiedPrintConfig 
} from "@/app/actions/settings"

export default async function PrintPage({ params, searchParams }: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await auth();
    const { id } = await params;
    const { type } = await searchParams;

    if (!session?.user?.companyId) return <div>Unauthorized</div>;

    const companyData = await getCurrentCompany();
    if (!companyData) return <div>Company configuration not found</div>;

    // Resolve Print Category (Usage)
    let usage = 'sale_bill';
    if (type === 'prescription' || type === 'appointment' || type === 'op_slip') {
        usage = 'op_slip';
    }

    // [NEW SOLUTION: STABLE API BRIDGE]
    // We bypass the complex React renderer and use a direct server-rendered HTML stream.
    // This solves all "Blank Page" and "Cheater" issues by providing a raw document to the browser.
    const pdfConfigRes = await getUnifiedPrintConfig(usage);
    const pdfConfig = pdfConfigRes.success ? pdfConfigRes.config : { coordinates: {}, source: 'fallback' };
    const autoPrint = (await searchParams).autoPrint === 'true';
    const printUrl = `/api/print/${type}/${id}${autoPrint ? '?autoPrint=true' : ''}`;

    return (
        <div className="w-screen h-screen m-0 p-0 bg-slate-100 flex flex-col overflow-hidden">
            <PrintPreviewHeader source={pdfConfig.source || 'stable'} usage={usage} />
            <div className="flex-1 w-full bg-slate-200 shadow-inner flex justify-center p-8 print:p-0 overflow-auto">
                <iframe 
                    src={printUrl} 
                    className="bg-white shadow-[0_30px_60px_rgba(0,0,0,0.3)] border-4 border-slate-200 print:border-none print:shadow-none transition-all" 
                    style={{ 
                        width: (pdfConfig.pageSizeSettings?.format === 'roll80' ? '80mm' : (pdfConfig.pageSizeSettings?.format === 'a5' ? '148mm' : '210mm')),
                        height: '297mm',
                        minHeight: '297mm'
                    }}
                    title="Print Preview" 
                />
            </div>
        </div>
    );
}
