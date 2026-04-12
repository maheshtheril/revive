import { jsPDF } from 'jspdf';
import { getPDFConfig } from '@/app/actions/settings';

const DEFAULT_COORDS: any = {
    logo: { x: 50, y: 50 },
    name: { x: 150, y: 50 },
    address: { x: 150, y: 85 },
    phone: { x: 150, y: 120 },
    email: { x: 150, y: 135 },
    docTitle: { x: 520, y: 50 },
    docId: { x: 520, y: 100 },
    docDate: { x: 520, y: 125 },
    token: { x: 520, y: 150, label: 'Token #', fontSize: 10, fontWeight: '900' },
    patientTitle: { x: 50, y: 220 },
    patientName: { x: 50, y: 240 },
    patientId: { x: 50, y: 275 },
    patientAgeGender: { x: 180, y: 275 },
    table: { x: 50, y: 450 },
    subtotal: { x: 500, y: 720 },
    tax: { x: 500, y: 745 },
    total: { x: 500, y: 780 },
    bank: { x: 50, y: 730 },
    qr: { x: 350, y: 730 },
    preparedBy: { x: 50, y: 920 },
    disclaimer: { x: 50, y: 950 },
    footer: { x: 250, y: 1000 }
};

export async function generateInvoicePDFBase64(invoice: any, company?: any, autoPrint: boolean = false): Promise<string> {
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // --- CALIBRATION: Designer (800px) to PDF (595pt) ---
        const scale = pageWidth / 800; // ~0.74375

        // --- Branding & Prism Architecture ---
        const config = await getPDFConfig(invoice.company_id!, invoice.tenant_id!);
        const coords = config?.coordinates;
        const logoUrl = company?.logo_url;
        const margin = 50 * scale;
        const metadata = company?.metadata as any;

        // 1. Clean Design (Removed background colors)

        // Helper to hex to RGB
        const hexToRgb = (hex: string) => {
            if (!hex || hex === 'transparent') return null;
            const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return res ? { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) } : null;
        };

        // Helper to render high-fidelity blocks with mathematical scaling
        const renderBlock = (id: string, content: string | string[], blockCoords: any, defaultStyle?: any) => {
            if (blockCoords?.showSection === false) return;
            if (!content) return;

            const fallback = DEFAULT_COORDS[id] || { x: 0, y: 0 };
            const x = (blockCoords?.x ?? fallback.x) * scale;
            const y = (blockCoords?.y ?? fallback.y) * scale;
            const fSize = (blockCoords.fontSize || defaultStyle?.fontSize || 10) * scale;
            const fWeight = blockCoords.fontWeight || defaultStyle?.fontWeight || 'normal';
            const fColor = hexToRgb(blockCoords.color || defaultStyle?.color || '#1e293b');
            const bgColor = hexToRgb(blockCoords.backgroundColor);
            const padding = (blockCoords.padding || 0) * scale;
            const bRadius = (blockCoords.borderRadius || 0) * scale;
            const lSpacing = (blockCoords.letterSpacing || 0) * scale;
            const width = (blockCoords.width || 0) * scale;

            doc.setFontSize(fSize);
            doc.setFont('helvetica', fWeight === '900' ? 'bold' : (fWeight === '400' ? 'normal' : 'bold'));
            
            // Calculate Background Rect
            if (bgColor) {
                doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
                const textHeight = Array.isArray(content) ? content.length * (fSize + (4 * scale)) : (fSize + (2 * scale));
                const rectW = width || (Array.isArray(content) ? (200 * scale) : doc.getTextWidth(content as string) + (padding * 2));
                const rectH = textHeight + (padding * 2);
                
                if (bRadius > 0) {
                    doc.roundedRect(x - padding, y - padding - (fSize/2), rectW, rectH, bRadius, bRadius, 'F');
                } else {
                    doc.rect(x - padding, y - padding - (fSize/2), rectW, rectH, 'F');
                }
            }

            if (fColor) doc.setTextColor(fColor.r, fColor.g, fColor.b);
            
            if (Array.isArray(content)) {
                content.forEach((line, idx) => {
                    doc.text(line, x, y + (idx * (fSize + (4 * scale))), { charSpace: lSpacing, baseline: 'top' });
                });
            } else {
                if (width > 0) {
                    const splitText = doc.splitTextToSize(content as string, width);
                    doc.text(splitText, x, y, { charSpace: lSpacing, baseline: 'top' });
                } else {
                    doc.text(content as string, x, y, { charSpace: lSpacing, baseline: 'top' });
                }
            }
        };

        // --- TABLE CONFIGURATION (LIFTED FOR SCOPE) ---
        const tBodySize = (coords?.table?.fontSize || 9);
        const tHeaderSize = (coords?.table?.headerFontSize || tBodySize);
        const tFooterSize = (coords?.table?.footerFontSize || tBodySize);
        const tableY = (coords?.table?.y || 450) * scale;
        
        const qtyX = (coords?.table?.qtyX || 320) * scale;
        const rateX = (coords?.table?.rateX || 420) * scale;
        const totalX = (coords?.table?.totalX || (800 - margin - 10)) * scale;

        // 2. Patient / Recipient Data
        const ptFull = (invoice.hms_patient?.full_name || `${invoice.hms_patient?.first_name || ""} ${invoice.hms_patient?.last_name || ""}`.trim() || invoice.customer_name || "").toUpperCase();
        
        // --- World Standard Multi-Page Engine ---
        let pageCount = 1;
        // 1. Logo & Name
        // 1. Logo & Name
        const renderPageHeader = async (isFollowPage: boolean = false) => {
            const showLogo = (config?.showLogo !== false) && (coords?.logo?.showSection !== false);
            if (showLogo && logoUrl) {
                const logoBase64 = await fetchImageAsBase64(logoUrl);
                if (logoBase64) {
                    const lWidth = (coords?.logo?.width || config?.logoSize || 80) * scale;
                    // Preserve aspect ratio (assume square or landscape)
                    doc.addImage(logoBase64, 'PNG', (coords?.logo?.x || 50) * scale, (coords?.logo?.y || 50) * scale, lWidth, lWidth);
                }
            }

            if (coords?.name && coords.name.showSection !== false) {
                renderBlock('name', company?.name?.toUpperCase() || 'HOSPITAL', coords.name, { fontSize: 24, fontWeight: '900', color: '#000000' });
            }

            const showContact = (config?.showContactInfo !== false);
            if (coords?.address && coords.address.showSection !== false && showContact) {
                renderBlock('address', metadata?.address || '', coords.address, { fontSize: 10, fontWeight: '600', color: '#666666' });
            }
            
            if (coords?.phone && coords.phone.showSection !== false && showContact) {
                renderBlock('phone', `P: ${metadata?.phone || ''}`, coords.phone, { fontSize: 9, fontWeight: '700', color: '#666666' });
            }

            if (coords?.email && coords.email.showSection !== false && showContact) {
                renderBlock('email', `E: ${metadata?.email || ''}`, coords.email, { fontSize: 9, fontWeight: '700', color: '#666666' });
            }

            // 2. Patient Identity (Sticky on every page)
            if (coords?.patientTitle && coords.patientTitle.showSection !== false) {
                renderBlock('patientTitle', coords.patientTitle.label || 'PATIENT INFORMATION', coords.patientTitle, { fontSize: 10, fontWeight: '900', color: '#94a3b8' });
            }

            if (coords?.patientName && coords.patientName.showSection !== false) {
                renderBlock('patientName', `PATIENT: ${ptFull}`, coords.patientName, { fontSize: 11, fontWeight: '900', color: '#0f172a' });
            }

            if (coords?.patientId && coords.patientId.showSection !== false) {
                renderBlock('patientId', `ID/MRN: ${invoice.hms_patient?.patient_number || ""}`, coords.patientId, { fontSize: 9, fontWeight: '700', color: '#64748b' });
            }

            if (coords?.patientAgeGender && coords.patientAgeGender.showSection !== false) {
                const ptAgeGender = `${invoice.hms_patient?.age || ''} ${invoice.hms_patient?.gender || ''}`.trim();
                renderBlock('patientAgeGender', `AGE/GENDER: ${ptAgeGender}`, coords.patientAgeGender, { fontSize: 9, fontWeight: '700', color: '#64748b' });
            }

            // 3. Document Meta
            if (coords?.docTitle && coords.docTitle.showSection !== false) {
                let titleText = coords.docTitle.label || 'TAX INVOICE';
                if (titleText === 'TAX INVOICE' && config?.showTaxInvoiceTitle === false) {
                    titleText = 'INVOICE';
                }
                renderBlock('docTitle', titleText, coords.docTitle, { fontSize: 11, fontWeight: '900', color: '#ffffff' });
            }

            if (coords?.docId && coords.docId.showSection !== false) {
                renderBlock('docId', `DOC #: ${invoice.invoice_number}`, coords.docId, { fontSize: 10, fontWeight: '400', color: '#000000' });
            }

            if (coords?.docDate && coords.docDate.showSection !== false) {
                const dateObj = new Date(invoice.invoice_date || invoice.created_at);
                const dStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                renderBlock('docDate', `DATE: ${dStr}`, coords.docDate, { fontSize: 9, fontWeight: '400', color: '#64748b' });
            }

            // --- TOKEN SYNC ---
            if (coords?.token && coords.token.showSection !== false) {
                const tokenVal = invoice.hms_visit?.token_number || invoice.token_number || "";
                if (tokenVal) {
                    renderBlock('token', `${coords.token.label || 'TOKEN:'} ${tokenVal}`, coords.token, { fontSize: 14, fontWeight: '900', color: '#059669' });
                }
            }

            // --- CLINICAL INJECTION (For dual-purpose documents) ---
            if (coords?.doctor && coords.doctor.showSection !== false) {
                const clinician = invoice.hms_visit?.hms_clinician || invoice.hms_visit?.clinician;
                if (clinician) {
                    const drName = `DR. ${clinician.first_name || ''} ${clinician.last_name || ''}`.trim();
                    renderBlock('doctor', drName, coords.doctor, { fontSize: 12, fontWeight: '900' });
                }
            }

            if (coords?.department && coords.department.showSection !== false) {
                const dept = invoice.hms_visit?.hms_department?.name || invoice.hms_visit?.department;
                if (dept) {
                    renderBlock('department', dept.toUpperCase(), coords.department, { fontSize: 9, fontWeight: '900' });
                }
            }

            // Vitals Matrix
            ['vitalBP', 'vitalPulse', 'vitalTemp', 'vitalWeight', 'vitalSpo2'].forEach(vKey => {
                if (coords?.[vKey] && coords[vKey].showSection !== false) {
                    const label = coords[vKey].label || vKey.replace('vital', '').toUpperCase();
                    // We render empty placeholders for manual entry on billing station if no clinical data yet
                    const val = "__________"; 
                    renderBlock(vKey, `${label}: ${val}`, coords[vKey], { fontSize: 9 });
                }
            });

            // Main Table Header (Re-renders on every page)
            if (coords?.table?.showSection !== false) {
                doc.setFillColor(15, 23, 42);
                doc.rect(margin, tableY, pageWidth - (margin * 2), 22 * scale, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(tHeaderSize * scale); doc.setFont('helvetica', 'bold');
                doc.text('SN', margin + (5 * scale), tableY + (15 * scale));
                doc.text('INVESTIGATION / DESCRIPTION', margin + (35 * scale), tableY + (15 * scale));
                doc.text('QTY', qtyX, tableY + (15 * scale), { align: 'right' });
                doc.text('RATE', rateX, tableY + (15 * scale), { align: 'right' });
                doc.text('TOTAL', totalX, tableY + (15 * scale), { align: 'right' });

                if (isFollowPage) {
                    doc.setFontSize(8 * scale); doc.setTextColor(148, 163, 184);
                    doc.text(`(CONTINUED FROM PAGE ${pageCount - 1})`, margin + (35 * scale), tableY + (30 * scale));
                }
            }
        };

        // Initialize First Page
        await renderPageHeader();

        let currentY = tableY + (38 * scale);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59); doc.setFontSize(tBodySize * scale);
        
        let totalQty = 0;
        let tableTotal = 0;
        const totalItemsCount = invoice.hms_invoice_lines.length;

        // --- RENDER TABLE ROWS (Only if shown) ---
        if (coords?.table?.showSection !== false) {
            for (let i = 0; i < invoice.hms_invoice_lines.length; i++) {
                const item = invoice.hms_invoice_lines[i];
                const qty = Number(item.quantity) || 0;
                const amt = Number(item.net_amount || item.total) || 0;
                totalQty += qty; tableTotal += amt;

                // Page Break Guard
                if (currentY > (pageHeight - 120)) {
                    doc.setFontSize(8 * scale); doc.setTextColor(148, 163, 184);
                    doc.text(`... CONTINUED ON PAGE ${pageCount + 1}`, totalX, pageHeight - 50, { align: 'right' });
                    doc.addPage();
                    pageCount++;
                    currentY = tableY + (38 * scale);
                    await renderPageHeader();
                    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59); doc.setFontSize(tBodySize * scale);
                }

                if (i % 2 === 0) {
                    doc.setFillColor(252, 252, 252);
                    doc.rect(margin, currentY - (12 * scale), pageWidth - (margin * 2), 20 * scale, 'F');
                }

                doc.setTextColor(30, 41, 59);
                doc.text(`${i + 1}`, margin + (5 * scale), currentY);
                const desc = item.hms_product?.name || item.description || "SERVICE";
                doc.text(desc.toUpperCase(), margin + (35 * scale), currentY);
                doc.text(`${qty}`, qtyX, currentY, { align: 'right' });
                doc.text(`${Number(item.unit_price || 0).toFixed(2)}`, rateX, currentY, { align: 'right' });
                doc.text(`${amt.toFixed(2)}`, totalX, currentY, { align: 'right' });

                currentY += 20 * scale;
            }

            // Table Footer (Only if table shown)
            const footerY = currentY + (10 * scale);
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, footerY - (14 * scale), pageWidth - (margin * 2), 20 * scale, 'F');
            doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.setFontSize(tFooterSize * scale);
            doc.text(`ITEMS count: ${totalItemsCount} | TOTALS:`, margin + (10 * scale), footerY);
            doc.text(String(totalQty), qtyX, footerY, { align: 'right' });
            doc.text(tableTotal.toFixed(2), totalX, footerY, { align: 'right' });
        }

        // --- SMART GRAVITY ENGINE ---
        const tableBottomY = (coords?.table?.showSection !== false) ? (currentY + 30) : (tableY + 30);
        
        // 5. Totals Area
        const currency = invoice.customer_currency || 'INR';
        const symbol = currency === 'INR' ? 'Rs. ' : currency + ' ';
        
        // Use renderBlock for Totals to ensure visibility guards and styling are respected
        if (coords?.subtotal && coords.subtotal.showSection !== false && coords?.table?.showSection !== false) {
            renderBlock('subtotal', `${coords.subtotal.label || 'Subtotal'}: ${symbol}${Number(invoice.subtotal).toLocaleString()}`, coords.subtotal);
        }

        if (coords?.tax && coords.tax.showSection !== false && coords?.table?.showSection !== false) {
            renderBlock('tax', `${coords.tax.label || 'Tax'}: ${symbol}${Number(invoice.total_tax || 0).toLocaleString()}`, coords.tax);
        }

        if (coords?.total && coords.total.showSection !== false && coords?.table?.showSection !== false) {
            renderBlock('total', `${coords.total.label || 'Final Payable'}: ${symbol}${Number(invoice.total).toLocaleString()}`, coords.total);
        }

        // 6. Optional Blocks
        if (coords?.bank && coords.bank.showSection !== false) {
            renderBlock('bank', coords.bank.label || '', coords.bank);
        }

        if (coords?.preparedBy && coords.preparedBy.showSection !== false) {
            const user = invoice.created_by_user;
            const prepName = (user?.full_name || user?.username || user?.name || "AUTHORIZED STAFF").toUpperCase();
            renderBlock('preparedBy', `${coords.preparedBy.label || 'Prepared By:'} ${prepName}`, coords.preparedBy);
        }

        if (coords?.qr && coords.qr.showSection !== false) {
            // QR Rendering Logic if needed
        }

        if (coords?.disclaimer && coords.disclaimer.showSection !== false) {
            renderBlock('disclaimer', coords.disclaimer.label || '', coords.disclaimer);
        }

        // 7. Global Footer (LOCK to Bottom of A4)
        doc.setFontSize(7 * scale);
        doc.setTextColor(148, 163, 184); 
        doc.setFont('helvetica', 'italic');
        // A4 Height is ~841pt. Lock signature to bottom (centered)
        doc.text('ELECTRONICALLY GENERATED DOCUMENT | ZIONA | ANTIGRAVITY OS', pageWidth / 2, pageHeight - 30, { align: 'center' });

        if (autoPrint) doc.autoPrint({ variant: 'non-conform' });
        return doc.output('datauristring').split(',')[1];
    } catch (err) {
        throw err;
    }
}

async function fetchImageAsBase64(url: string, timeoutMs: number = 3000): Promise<string | null> {
    try {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/png';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        return null;
    }
}

export async function generateOPSlipPDFBase64(visit: any, company: any, autoPrint: boolean = false): Promise<string> {
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const scale = pageWidth / 800;

        const config = await getPDFConfig(visit.company_id!, visit.tenant_id!, 'op_slip');
        const coords = config?.coordinates;
        const logoUrl = company?.logo_url;
        const metadata = company?.metadata as any;

        const hexToRgb = (hex: string) => {
            if (!hex || hex === 'transparent') return null;
            const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return res ? { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) } : null;
        };

        const OP_DEFAULTS: any = {
            logo: { x: 50, y: 50 },
            name: { x: 150, y: 50 },
            address: { x: 150, y: 85 },
            phone: { x: 150, y: 120 },
            email: { x: 150, y: 135 },
            docTitle: { x: 520, y: 50 },
            token: { x: 520, y: 100 },
            docDate: { x: 520, y: 150 },
            patientName: { x: 50, y: 200 },
            patientId: { x: 50, y: 230 },
            patientDemographics: { x: 50, y: 245 },
            doctor: { x: 50, y: 310 },
            department: { x: 50, y: 345 },
            vitalBP: { x: 520, y: 200 },
            vitalPulse: { x: 620, y: 200 },
            vitalTemp: { x: 520, y: 250 },
            vitalWeight: { x: 620, y: 250 },
            vitalSpo2: { x: 520, y: 280 },
            rxSymbol: { x: 50, y: 400 },
            notes: { x: 50, y: 900 },
            bank: { x: 50, y: 1000 },
            qr: { x: 520, y: 980 }
        };

        const renderBlock = (id: string, content: string | string[], blockCoords: any, defaultStyle?: any) => {
            if (blockCoords?.showSection === false) return;
            if (!content) return;

            const fallback = OP_DEFAULTS[id] || { x: 0, y: 0 };
            const x = (blockCoords?.x ?? fallback.x) * scale;
            const y = (blockCoords?.y ?? fallback.y) * scale;
            const fSize = (blockCoords?.fontSize || defaultStyle?.fontSize || 10) * scale;
            const fWeight = blockCoords?.fontWeight || defaultStyle?.fontWeight || 'normal';
            const fColor = hexToRgb(blockCoords?.color || defaultStyle?.color || '#000000');
            const bgColor = hexToRgb(blockCoords?.backgroundColor);
            const padding = (blockCoords?.padding || 0) * scale;
            const bRadius = (blockCoords?.borderRadius || 0) * scale;
            const width = (blockCoords?.width || 0) * scale;

            doc.setFontSize(fSize);
            doc.setFont('helvetica', fWeight === '900' ? 'bold' : (fWeight === '400' ? 'normal' : 'bold'));

            if (bgColor) {
                doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
                const textHeight = Array.isArray(content) ? content.length * (fSize + 2) : (fSize + 2);
                const rectW = width || (Array.isArray(content) ? (200 * scale) : doc.getTextWidth(content as string) + (padding * 2));
                doc.rect(x - padding, y - padding, rectW, textHeight + (padding * 2), 'F');
            }

            if (fColor) doc.setTextColor(fColor.r, fColor.g, fColor.b);
            doc.text(content as string, x, y, { baseline: 'top' });
        };

        // Header Logic
        const showLogo = (config?.showLogo !== false) && (coords?.logo?.showSection !== false);
        if (showLogo && logoUrl) {
            const logoBase64 = await fetchImageAsBase64(logoUrl);
            if (logoBase64) {
                const lWidth = (coords?.logo?.width || 80) * scale;
                doc.addImage(logoBase64, 'PNG', (coords?.logo?.x || 50) * scale, (coords?.logo?.y || 50) * scale, lWidth, lWidth);
            }
        }

        renderBlock('name', company?.name?.toUpperCase() || 'HOSPITAL', coords?.name, { fontSize: 24, fontWeight: '900' });
        renderBlock('address', metadata?.address || '', coords?.address, { fontSize: 10 });
        renderBlock('phone', `P: ${metadata?.phone || ''}`, coords?.phone, { fontSize: 9 });
        renderBlock('email', `E: ${metadata?.email || ''}`, coords?.email, { fontSize: 9 });

        // Meta
        if (coords?.docTitle && coords.docTitle.showSection !== false) {
            renderBlock('docTitle', coords.docTitle.label || 'OP SLIP', coords.docTitle, { fontSize: 11, fontWeight: '900' });
        }
        
        if (coords?.token && coords.token.showSection !== false) {
            const tokenDisplay = visit.token_number || (visit.id && visit.id.toString().split('-')[0].toUpperCase()) || '#N/A';
            renderBlock('token', `${coords.token.label || 'TOKEN:'} ${tokenDisplay}`, coords.token, { fontWeight: '900' });
        }

        if (coords?.docId && coords.docId.showSection !== false) {
            const visitId = visit.id?.toString().toUpperCase() || 'N/A';
            renderBlock('docId', `ID: ${visitId}`, coords.docId, { fontSize: 8, color: '#64748b' });
        }
        
        if (coords?.docDate && coords.docDate.showSection !== false) {
            const dateObj = new Date(visit.starts_at || visit.date || visit.created_at || new Date());
            const dStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            renderBlock('docDate', `Date: ${dStr}`, coords.docDate, { fontSize: 9 });
        }

        // Patient
        const patient = visit.hms_patient || visit.patient;
        const ptName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'PATIENT';
        
        if (coords?.patientName && coords.patientName.showSection !== false) {
            renderBlock('patientName', ptName.toUpperCase(), coords.patientName, { fontSize: 20, fontWeight: '900' });
        }

        if (coords?.patientId && coords.patientId.showSection !== false) {
            renderBlock('patientId', `MRN: ${patient?.patient_number || 'N/A'}`, coords.patientId, { fontSize: 10, fontWeight: '700' });
        }
        
        if (coords?.patientDemographics && coords.patientDemographics.showSection !== false) {
            const demo = `${patient?.gender || ''} / ${patient?.age || ''}Y`.trim();
            renderBlock('patientDemographics', demo, coords.patientDemographics, { fontSize: 10, fontWeight: '700' });
        }

        // Doctor
        const clinician = visit.hms_clinician || visit.clinician;
        if (coords?.doctor && coords.doctor.showSection !== false) {
            const drName = `DR. ${clinician?.first_name || ''} ${clinician?.last_name || ''}`.trim();
            renderBlock('doctor', drName, coords.doctor, { fontSize: 12, fontWeight: '900' });
        }

        if (coords?.department && coords.department.showSection !== false) {
            renderBlock('department', visit.hms_department?.name || visit.department || '', coords.department, { fontSize: 9, fontWeight: '900' });
        }

        // --- VITALS SYNC (Nursing -> Clinician Handoff) ---
        const vitals = Array.isArray(visit.hms_vitals) ? visit.hms_vitals[0] : (visit.hms_vitals || visit.vitals);
        
        const renderVital = (vKey: string, label: string, val: any, unit: string = '') => {
            if (coords?.[vKey] && coords[vKey].showSection !== false) {
                // If value exists and isn't just a slash, show it; otherwise show writing line
                const cleanVal = (val && val !== '/') ? `${val}${unit}` : "__________"; 
                renderBlock(vKey, `${label}: ${cleanVal}`, coords[vKey], { fontSize: 9 });
            }
        };

        const bpVal = (vitals?.systolic || vitals?.diastolic) ? `${vitals.systolic || ''}/${vitals.diastolic || ''}` : null;
        renderVital('vitalBP', coords?.vitalBP?.label || 'BP', bpVal, ' mmHg');
        renderVital('vitalPulse', coords?.vitalPulse?.label || 'PULSE', vitals?.pulse, ' bpm');
        renderVital('vitalTemp', coords?.vitalTemp?.label || 'TEMP', vitals?.temperature, ' °F');
        renderVital('vitalWeight', coords?.vitalWeight?.label || 'WEIGHT', vitals?.weight, ' kg');
        renderVital('vitalSpo2', coords?.vitalSpo2?.label || 'SpO2', vitals?.spo2, ' %');

        // Clinical Sections
        if (coords?.labTests && coords.labTests.showSection !== false) {
            renderBlock('labTests', coords.labTests.label || 'INVESTIGATIONS ORDERED:', coords.labTests, { fontSize: 10, fontWeight: '900' });
            // Show up to 5 empty lines for manual entry or actual tests if provided
            let testLines = (visit.hms_lab_order?.[0]?.hms_lab_order_line || []).map((l: any) => `- ${l.hms_lab_test?.name || 'Test'}`);
            if (testLines.length === 0) testLines = ["1. ____________________", "2. ____________________"];
            
            const startX = (coords.labTests.x || 520) * scale;
            let startY = (coords.labTests.y || 400) * scale + 20;
            doc.setFontSize(9 * scale); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
            testLines.forEach((line: string) => {
                doc.text(line, startX, startY);
                startY += 15 * scale;
            });
        }

        if (coords?.rxSymbol && coords.rxSymbol.showSection !== false) {
            renderBlock('rxSymbol', coords.rxSymbol.label || '℞', coords.rxSymbol, { fontSize: 40, fontWeight: '900', color: '#000000', opacity: 0.2 });
        }

        if (coords?.notes && coords.notes.showSection !== false) {
            renderBlock('notes', coords.notes.label || 'CLINICAL NOTES / RX:', coords.notes, { fontSize: 10, fontWeight: '900' });
            // Render lines if empty
            const lineX = (coords.notes.x || 50) * scale;
            let lineY = (coords.notes.y || 900) * scale + 25;
            doc.setDrawColor(226, 232, 240);
            for(let i=0; i<5; i++) {
                doc.line(lineX, lineY, lineX + ((coords.notes.width || 700) * scale), lineY);
                lineY += 25 * scale;
            }
        }

        if (coords?.bank && coords.bank.showSection !== false) {
            renderBlock('bank', coords.bank.label || '', coords.bank, { fontSize: 8, color: '#059669' });
        }

        if (coords?.qr && coords.qr.showSection !== false) {
            const qrX = (coords.qr.x || 520) * scale;
            const qrY = (coords.qr.y || 980) * scale;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(qrX, qrY, 60 * scale, 60 * scale, 10, 10, 'F');
            doc.setFontSize(6 * scale); doc.setTextColor(148, 163, 184);
            doc.text('SCAN TO AUDIT', qrX + (30 * scale), qrY + (55 * scale), { align: 'center' });
        }

        if (coords?.preparedBy && coords.preparedBy.showSection !== false) {
            renderBlock('preparedBy', `${coords.preparedBy.label || 'PREPARED BY:'} ${visit.created_by_name || 'STAFF'}`, coords.preparedBy, { fontSize: 9, fontWeight: '700' });
        }

        if (coords?.footer) {
            doc.setFontSize(8 * scale); doc.setTextColor(148, 163, 184);
            doc.text('COMPUTER GENERATED OP SLIP | ZIONA HMS ELITE', pageWidth / 2, (coords.footer.y || 1080) * scale, { align: 'center' });
        }
        if (autoPrint) doc.autoPrint({ variant: 'non-conform' });
        return doc.output('datauristring').split(',')[1];
    } catch (err) {
        throw err;
    }
}

export async function generateLabReportPDFBase64(order: any, company?: any): Promise<string> {
    const doc = new jsPDF();
    doc.text("Lab Report Atomic Fix", 20, 20);
    return doc.output('datauristring').split(',')[1];
}
