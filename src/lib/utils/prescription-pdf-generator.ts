import { jsPDF } from 'jspdf';
import { getPDFConfig } from '@/app/actions/settings';
import { compileTemplate } from './pdf-defaults';

export async function generatePrescriptionPDFBase64(prescription: any, company?: any, autoPrint: boolean = false): Promise<string> {
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // --- CALIBRATION: Designer (800px) to PDF (595pt) ---
        const scale = pageWidth / 800; 

        // --- Branding & Prism Architecture ---
        const config = await getPDFConfig(prescription.company_id!, prescription.tenant_id!, 'prescription');
        const coords = config?.coordinates;
        const margin = 50 * scale;
        const logoUrl = company?.logo_url;
        const companyName = company?.name || 'Hospital Administration';
        const meta = company?.metadata as any;

        // --- Block Renderer Utility ---
        const renderBlock = (key: string, content: string, overrides?: any, style: 'normal' | 'bold' | 'black' = 'normal') => {
            const block = { ...(coords?.[key] || {}), ...overrides };
            if (block.showSection === false) return null;

            const fSize = (block.fontSize || 10) * scale;
            const x = (block.x || 50) * scale;
            const y = (block.y || 100) * scale;
            const color = block.color || '#0f172a';

            doc.setFontSize(fSize);
            doc.setTextColor(color);
            doc.setFont('helvetica', style === 'bold' ? 'bold' : style === 'black' ? 'black' : 'normal');
            
            if (block.backgroundColor) {
                const pad = (block.padding || 0) * scale;
                doc.setFillColor(block.backgroundColor);
                const textWidth = doc.getTextWidth(content);
                doc.rect(x - pad, y - fSize - (pad/2), textWidth + (pad * 2), fSize + pad, 'F');
            }

            const splitContent = doc.splitTextToSize(content, (block.width || 700) * scale);
            doc.text(splitContent, x, y + fSize);
            return y + (fSize * splitContent.length) + 10;
        };

        // 1. Branding Header
        if (logoUrl) {
            const logoBase = await fetchImageAsBase64(logoUrl);
            if (logoBase) {
                const lSize = (coords?.logo?.width || config?.logoSize || 60) * scale;
                doc.addImage(logoBase, 'PNG', (coords?.logo?.x || 50) * scale, (coords?.logo?.y || 50) * scale, lSize, lSize);
            }
        }

        renderBlock('name', companyName.toUpperCase(), { x: 150, y: 50, fontSize: 24 }, 'bold');
        renderBlock('address', meta?.address || '', { x: 150, y: 85, fontSize: 9, color: '#64748b' });
        renderBlock('phone', `Ph: ${meta?.phone || ''}`, { x: 150, y: 110, fontSize: 8, color: '#64748b' });

        // [ENGINE] MINIMALIST DYNAMIC CORE
        // All non-company identifiers and medical blocks are now dynamic via the loop below.
        
        const pt = prescription.hms_patient || prescription.patient || {};
        const docObj = prescription.doctor || prescription.hms_doctor || {};
        const dataContext = { 
            prescription, 
            patient: pt, 
            doctor: docObj, 
            company, 
            metadata: meta 
        };

        Object.keys(coords || {}).forEach((k) => {
            if (k.startsWith('dynamic_') && coords[k].showSection !== false && coords[k].label) {
                const compiledText = compileTemplate(coords[k].label, dataContext);
                renderBlock(k, compiledText, coords[k]);
            }
        });

        // 3. Clinical Findings (Rx Symbol & Medication Table)
        // These remain structured for medical safety, but follow the designer's table coordinates.
        let clinicalY = (coords?.rxSymbol?.y || 280) * scale;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(40 * scale);
        doc.setFont('helvetica', 'bold');
        doc.text('℞', margin, clinicalY + (20 * scale));

        const tableY = (coords?.table?.y || 400) * scale;
        doc.setFillColor(15, 23, 42);
        doc.rect(margin, tableY, pageWidth - (margin * 2), 22 * scale, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8 * scale);
        doc.setFont('helvetica', 'bold');
        doc.text('MEDICATION', margin + 10, tableY + (14 * scale));
        doc.text('DOSAGE', 300 * scale, tableY + (14 * scale));
        doc.text('PERIOD', 400 * scale, tableY + (14 * scale));
        doc.text('TIMING', 480 * scale, tableY + (14 * scale));

        let currentY = tableY + (35 * scale);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9 * scale);
        doc.setFont('helvetica', 'normal');

        const meds = Array.isArray(prescription.medicines) ? prescription.medicines : (prescription.prescription_items || []);
        meds.forEach((item: any, idx: number) => {
            if (idx % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, currentY - (12 * scale), pageWidth - (margin * 2), 22 * scale, 'F');
            }
            const name = item.hms_product?.name || item.name || 'Generic Medicine';
            const dosage = item.dosage || `${item.morning || 0}-${item.afternoon || 0}-${item.evening || 0}-${item.night || 0}`;
            const duration = `${item.days || item.duration || '-'} Days`;
            const timing = item.timing || 'Post-Meal';

            doc.text(name.toUpperCase(), margin + 10, currentY);
            doc.text(dosage, 300 * scale, currentY);
            doc.text(duration, 400 * scale, currentY);
            doc.text(timing, 480 * scale, currentY);
            currentY += 22 * scale;
        });

        if (prescription.plan) {
            currentY += 20 * scale;
            doc.setFont('helvetica', 'bold');
            doc.text('ADVICE / PLAN:', margin, currentY);
            doc.setFont('helvetica', 'normal');
            const splitAdvice = doc.splitTextToSize(prescription.plan, pageWidth - (margin * 2));
            doc.text(splitAdvice, margin, currentY + (15 * scale));
        }

        // Global Footer
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7 * scale);
        doc.text(`DATE: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - (20 * scale), { align: 'center' });

        if (autoPrint) doc.autoPrint({ variant: 'non-conform' });
        return doc.output('datauristring').split(',')[1];
    } catch (err) {
        throw err;
    }
}

/**
 * Helper to fetch external image and convert to Base64 for PDF embedding
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        if (!url) return null;
        if (url.startsWith('data:')) return url;

        const response = await fetch(url);
        if (!response.ok) return null;

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/png';

        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error("fetchImageAsBase64 failed:", error);
        return null;
    }
}
