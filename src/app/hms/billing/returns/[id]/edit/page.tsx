
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"
import { getPDFConfig } from "@/app/actions/settings"

export default async function EditSalesReturnPage({ 
    params 
}: { 
    params: Promise<{ id: string }>
}) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.companyId) return <div>Unauthorized</div>;

    const sReturn = await prisma.hms_sales_return.findUnique({
        where: {
            id,
            company_id: session.user.companyId
        },
        include: {
            lines: {
                include: {
                    hms_product: true,
                    hms_invoice_line: true
                }
            },
            hms_invoice: {
                include: {
                    hms_invoice_lines: true
                }
            }
        }
    });

    if (!sReturn) return notFound();

    // Fetch necessary data for the terminal
    const [patients, products, uoms, taxConfig, pdfConfig] = await Promise.all([
        prisma.hms_patient.findMany({ where: { company_id: session.user.companyId }, take: 10 }),
        prisma.hms_product.findMany({ where: { company_id: session.user.companyId, is_active: true }, take: 20 }),
        prisma.hms_uom.findMany({ where: { company_id: session.user.companyId } }),
        prisma.company_tax_maps.findMany({ 
            where: { company_id: session.user.companyId },
            include: { tax_rates: true }
        }),
        getPDFConfig()
    ]);

    return (
        <div className="min-h-screen bg-slate-950">
            <CompactInvoiceEditor 
                mode="return"
                patients={JSON.parse(JSON.stringify(patients.map(p => ({
                    id: p.id,
                    name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                    phone: (p.contact as any)?.phone || (p.contact as any)?.mobile || '',
                    patient_number: p.patient_number
                }))))}
                billableItems={JSON.parse(JSON.stringify(products.map(p => ({
                    id: p.id,
                    sku: p.sku || '',
                    label: p.name,
                    price: Number(p.price || 0),
                    type: p.is_service ? 'service' : 'item',
                    totalStock: 0 // Will be updated by terminal fetch if needed
                }))))}
                uoms={JSON.parse(JSON.stringify(uoms))}
                taxConfig={{ 
                    defaultTax: null, 
                    taxRates: JSON.parse(JSON.stringify(taxConfig.map(m => m.tax_rates).filter(Boolean)))
                }}
                initialInvoice={JSON.parse(JSON.stringify(sReturn.hms_invoice))}
                initialReturn={JSON.parse(JSON.stringify(sReturn))}
                currency={pdfConfig.currencySymbol || '₹'}
            />
        </div>
    );
}
