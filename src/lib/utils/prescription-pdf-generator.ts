import { jsPDF } from 'jspdf';
import { getPDFConfig } from '@/app/actions/settings';

export async function generatePrescriptionPDFBase64(prescription: any, company?: any): Promise<string> {
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
        const companyName = company?.name || 'Ziona Antigravity HMS';
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
                const lSize = (config?.logoSize || 60) * scale;
                doc.addImage(logoBase, 'PNG', (coords?.logo?.x || 50) * scale, (coords?.logo?.y || 50) * scale, lSize, lSize);
            }
        }

        renderBlock('name', companyName.toUpperCase(), { x: 150, y: 50, fontSize: 24 }, 'bold');
        renderBlock('address', meta?.address || 'Premium Healthcare Protocol', { x: 150, y: 85, fontSize: 9, color: '#64748b' });
        renderBlock('phone', `Ph: ${meta?.phone || ''} | ${meta?.email || ''}`, { x: 150, y: 110, fontSize: 8, color: '#64748b' });

        renderBlock('docTitle', 'MEDICAL PRESCRIPTION', { x: 520, y: 50, backgroundColor: '#059669', color: '#ffffff', padding: 12, fontSize: 11 }, 'black');

        // 2. Patient Metadata
        const pt = prescription.hms_patient || {};
        const ptFull = `${pt.first_name || ''} ${pt.last_name || ''}`.trim() || 'CASH PATIENT';
        const docName = prescription.doctor?.name || 'Authorized Doctor';

        renderBlock('patientName', ptFull.toUpperCase(), { x: 50, y: 200, fontSize: 18 }, 'bold');
        renderBlock('patientId', `MRN: ${pt.patient_number || '####'} | AGE: ${pt.age || '-'}Y | ${pt.gender || '--'}`, { x: 50, y: 225, fontSize: 9, color: '#64748b' });

        renderBlock('doctor', docName.toUpperCase(), { x: 520, y: 200, fontSize: 11 }, 'bold');
        renderBlock('department', prescription.department || 'CLINIC', { x: 520, y: 215, fontSize: 8, color: '#059669' }, 'bold');

        // 3. Clinical Findings (The RX Core)
        let clinicalY = 280 * scale;

        // Rx Symbol
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(40 * scale);
        doc.setFont('helvetica', 'bold');
        doc.text('℞', margin, clinicalY + (20 * scale));

        clinicalY += 40 * scale;

        // Medication Table
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

        // 4. Advice / Lab
        if (prescription.plan || prescription.labTests?.length > 0) {
            currentY += 40 * scale;
            if (prescription.plan) {
                doc.setFont('helvetica', 'bold');
                doc.text('ADVICE / PLAN:', margin, currentY);
                doc.setFont('helvetica', 'normal');
                const splitAdvice = doc.splitTextToSize(prescription.plan, pageWidth - (margin * 2));
                doc.text(splitAdvice, margin, currentY + (15 * scale));
                currentY += (splitAdvice.length * 12) + (30 * scale);
            }

            if (prescription.labTests?.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.text('INVESTIGATIONS ORDERED:', margin, currentY);
                doc.setFont('helvetica', 'normal');
                prescription.labTests.forEach((lab: any, i: number) => {
                    doc.text(`${i+1}. ${lab.name || lab}`, margin + 10, currentY + ((i+1) * 15 * scale));
                });
            }
        }

        // 5. Signature Area (Fixed Bottom)
        const sigY = pageHeight - (120 * scale);
        doc.setDrawColor(203, 213, 225);
        doc.line(pageWidth - margin - (180 * scale), sigY, pageWidth - margin, sigY);
        doc.setFont('helvetica', 'bold');
        doc.text(docName.toUpperCase(), pageWidth - margin - (90 * scale), sigY + (15 * scale), { align: 'center' });
        doc.setFontSize(7 * scale);
        doc.setTextColor(148, 163, 184);
        doc.text('AUTHORIZED CLINICAL SIGNATURE', pageWidth - margin - (90 * scale), sigY + (25 * scale), { align: 'center' });

        // Global Footer
        doc.setTextColor(148, 163, 184);
        doc.text(`ZIONA HMS WORLD STANDARD RX ENGINE | DATE: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - (20 * scale), { align: 'center' });

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
