import { jsPDF } from 'jspdf';
import { getPDFConfig } from '@/app/actions/settings';

export async function generateInvoicePDFBase64(invoice: any, company?: any, autoPrint: boolean = false): Promise<string> {
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // --- Branding & Configuration ---
        const config = await getPDFConfig(invoice.company_id!, invoice.tenant_id!);
        const alignment = config?.headerAlignment || 'right';
        const showLogo = config?.showLogo ?? true;
        const logoUrl = company?.logo_url;

        let headerY = 60;
        const margin = 50;
        const contentWidth = pageWidth - (margin * 2);

        // Hospital Details
        const companyName = company?.name || 'Hospital Management System';
        const meta = company?.metadata as any;
        const address = meta?.address || 'Healthcare Excellence';
        const contactStr = (meta?.email || meta?.phone)
            ? `${meta?.email || ''}${meta?.email && meta?.phone ? ' | ' : ''}${meta?.phone || ''}`
            : 'Premium Healthcare Services';

        // 1. Draw Title (TAX INVOICE) - always top left
        const showTaxInvoice = config?.showTaxInvoiceTitle ?? true;
        if (showTaxInvoice) {
            doc.setTextColor(68, 68, 68);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('TAX INVOICE', margin, headerY);
            headerY += 15;
        }

        doc.setFontSize(8); 
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(68, 68, 68);
        doc.text(`Invoice #: ${invoice.invoice_number}`, margin, headerY);
        doc.text(`Date: ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}`, margin, headerY + 12);

        // 2. Draw Logo if enabled
        let logoHeight = 0;
        if (showLogo && logoUrl) {
            try {
                let logoX = margin;
                if (alignment === 'right') logoX = pageWidth - margin - 60;
                else if (alignment === 'center') logoX = (pageWidth / 2) - 30;

                const logoBase64 = await fetchImageAsBase64(logoUrl);
                if (logoBase64) {
                    doc.addImage(logoBase64, 'PNG', logoX, headerY - 30, 60, 60, undefined, 'FAST');
                    logoHeight = 40; // Space occupied by logo
                }
            } catch (e) {
                console.error("[PDF-Logo] Failed to embed logo:", e);
            }
        }

        // 3. Draw Branding Info
        const brandX = alignment === 'right' ? pageWidth - margin : (alignment === 'center' ? pageWidth / 2 : margin);
        const textAlign = alignment;

        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.setFontSize(config?.hospitalNameSize || 12); // Reduced default from 16
        doc.setFont('helvetica', 'bold');

        let brandY = headerY + logoHeight; // Move down if logo exists
        if (alignment === 'center') brandY = headerY + 60;
        if (alignment === 'left') brandY = headerY + 70;

        doc.text(companyName, brandX, brandY, { align: textAlign });

        doc.setTextColor(102, 102, 102);
        doc.setFontSize(config?.addressSize || 8); // Reduced default from 10
        doc.setFont('helvetica', 'normal');
        doc.text(address, brandX, brandY + 12, { align: textAlign });

        if (config?.showContactInfo !== false) {
            doc.text(contactStr, brandX, brandY + 22, { align: textAlign });
        }

        if (meta?.gstin) {
            doc.text(`GSTIN: ${meta.gstin}`, brandX, brandY + 32, { align: textAlign });
        }

        // Divider
        doc.setDrawColor(238, 238, 238);
        const dividerY = Math.max(brandY + 45, 125);
        doc.line(margin, dividerY, pageWidth - margin, dividerY);

        // --- Patient Info ---
        doc.setTextColor(153, 153, 153);
        doc.setFontSize(8);
        doc.text('BILL TO', margin, dividerY + 20);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10); // Reduced from 12
        doc.setFont('helvetica', 'bold');
        doc.text(`${invoice.hms_patient?.first_name} ${invoice.hms_patient?.last_name}`, margin, dividerY + 35); // Relative positioning

        doc.setTextColor(102, 102, 102);
        doc.setFontSize(8); // Reduced from 10
        doc.setFont('helvetica', 'normal');
        doc.text(`Patient ID: ${invoice.hms_patient?.patient_number || 'N/A'}`, margin, dividerY + 47);
        doc.text(`Mobile: ${((invoice.hms_patient?.contact as any)?.phone) || 'N/A'}`, margin, dividerY + 59);

        const patientMeta = invoice.hms_patient?.metadata as any;
        if (patientMeta?.registration_expiry) {
            const expiryStr = new Date(patientMeta.registration_expiry).toLocaleDateString();
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 38, 38); // Red-600
            doc.text(`Registration Valid Till: ${expiryStr}`, margin, dividerY + 71);
            doc.setTextColor(102, 102, 102);
            doc.setFont('helvetica', 'normal');
        }

        // --- Table Headers ---
        const tableTop = 230;
        const currency = invoice.currency || 'INR';
        const symbol = currency === 'INR' ? 'Rs. ' : currency + ' ';

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(68, 68, 68);
        doc.text('Item Description', 50, tableTop);
        doc.text('Qty', 300, tableTop, { align: 'right' });
        doc.text(`Price (${currency})`, 400, tableTop, { align: 'right' });
        doc.text(`Total (${currency})`, pageWidth - 50, tableTop, { align: 'right' });

        doc.setDrawColor(238, 238, 238);
        doc.line(50, tableTop + 7, pageWidth - 50, tableTop + 7);

        // --- Table Rows ---
        let currentY = tableTop + 25;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);

        invoice.hms_invoice_lines.forEach((item: any) => {
            const description = item.description || 'Item';
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            const total = Number(item.net_amount) || 0;

            const splitDesc = doc.splitTextToSize(description, 230);
            doc.text(splitDesc, 50, currentY);
            doc.text(qty.toString(), 300, currentY, { align: 'right' });
            doc.text(price.toLocaleString('en-IN'), 400, currentY, { align: 'right' });
            doc.text(total.toLocaleString('en-IN'), pageWidth - 50, currentY, { align: 'right' });

            currentY += Math.max(splitDesc.length * 12, 20) + 10;
        });

        // --- Totals Section ---
        let totalsY = currentY + 20;
        doc.line(350, totalsY, pageWidth - 50, totalsY);

        const rightLabelX = 360;
        const rightValueX = pageWidth - 50;

        doc.setFontSize(10);
        doc.text('Subtotal:', rightLabelX, totalsY + 20);
        doc.text(`${symbol}${Number(invoice.subtotal).toLocaleString('en-IN')}`, rightValueX, totalsY + 20, { align: 'right' });

        doc.text('Tax:', rightLabelX, totalsY + 35);
        doc.text(`${symbol}${Number(invoice.total_tax).toLocaleString('en-IN')}`, rightValueX, totalsY + 35, { align: 'right' });

        if (Number(invoice.total_discount) > 0) {
            doc.setTextColor(239, 68, 68); // Red-500
            doc.text('Discount:', rightLabelX, totalsY + 50);
            doc.text(`-${symbol}${Number(invoice.total_discount).toLocaleString('en-IN')}`, rightValueX, totalsY + 50, { align: 'right' });
            totalsY += 15;
        }

        const grandTotalY = totalsY + 65;
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(350, grandTotalY - 15, pageWidth - 350 - 50, 40, 'F');

        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('GRAND TOTAL', 365, grandTotalY + 10);
        doc.setFontSize(16);
        doc.text(`${symbol}${Number(invoice.total).toLocaleString('en-IN')}`, rightValueX - 10, grandTotalY + 10, { align: 'right' });

        // --- Footer ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(153, 153, 153);
        const footerText1 = 'This is a computer generated invoice and does not require a signature.';
        const footerText2 = `Generated on ${new Date().toLocaleString()}`;

        doc.text(footerText1, pageWidth / 2, 780, { align: 'center' });
        doc.text(footerText2, pageWidth / 2, 795, { align: 'center' });

        if (autoPrint) {
            doc.autoPrint({ variant: 'non-conform' });
        }

        return doc.output('datauristring').split(',')[1];
    } catch (err) {
        throw err;
    }
}

/**
 * Helper to fetch external image and convert to Base64 for PDF embedding
 */
async function fetchImageAsBase64(url: string, timeoutMs: number = 3000): Promise<string | null> {
    try {
        if (!url) return null;
        if (url.startsWith('data:')) return url;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            
            if (!response.ok) return null;

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = response.headers.get('content-type') || 'image/png';

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (fetchErr) {
            clearTimeout(timeout);
            console.error("[PDF-Logo] Fetch timed out or failed:", url);
            return null;
        }
    } catch (error) {
        console.error("fetchImageAsBase64 failed:", error);
        return null;
    }
}
