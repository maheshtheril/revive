import { jsPDF } from 'jspdf';
import { getPDFConfig, getHMSSettings } from '@/app/actions/settings';
import { compileTemplate, WORLD_STANDARD_DEFAULTS } from '@/lib/utils/pdf-defaults';
import { formatDate, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from '@/lib/format-utils';

export type PDFUsage = 'op_slip' | 'sale_bill' | 'sales_return' | 'purchase_return' | 'purchase_receipt' | 'prescription' | 'lab_report' | 'doctor_note';

/**
 * WORLD-CLASS UNIFIED PDF ENGINE (v4 - Server-Safe)
 */
export async function generateUniversalPDF(
    usage: PDFUsage,
    data: any,
    company: any,
    branchId?: string,
    autoPrint: boolean = false,
    configOverride?: any
): Promise<string> {
    try {
        console.log(`[ENGINE] Generating ${usage} for ${data.id || 'new document'}`);
        let config = configOverride || await getPDFConfig(data.company_id || company.id, data.tenant_id || company.tenant_id, usage, branchId);
        const hmsSettingsRes = await getHMSSettings();
        const hmsSettings = hmsSettingsRes?.success ? hmsSettingsRes.settings : null;

        // [ENGINE] Template Audit: Ensuring source-of-truth configuration
        const hasDbCoords = config?.coordinates && Object.keys(config.coordinates).length > 0;
        const isRecovery = !!config?.recoveryMode;
        console.log(`[PDF-RADAR] Usage: ${usage} | Source: ${isRecovery ? 'RECOVERY (Hardcoded)' : (hasDbCoords ? 'DATABASE ✓' : 'EMPTY ✗')} | Template: ${config?.name || 'N/A'}`);
        // -----------------------

        const requestedSize = config?.pageSizeSettings?.format || 'a4';
        const finalPageSize = requestedSize;

        const doc = new jsPDF('p', 'pt', finalPageSize === 'a5' ? 'a5' : 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Calibration: 1:1 points mapping (Standard A4 is 595.28 pts wide)
        const scale = pageWidth / 595.28;

        const coords = config?.coordinates || {};
        const companyData = company || {};
        const meta = companyData.metadata || {};
        const patientData = data.hms_patient || data.patient || {};
        let clinicianData = data.hms_clinician || data.clinician || data.doctor || data.hms_doctor || data.hms_appointment?.hms_clinician || data.appointment?.clinician || {};

        // Secondary discovery for sparse data cases
        if (!clinicianData?.id && (data.metadata as any)?.clinician_id) {
            console.log("[ENGINE] Attempting clinician recovery from metadata...");
        }

        const appointmentData = data.hms_appointment || data.appointment || (data.starts_at ? data : {});

        // WORLD-CLASS TAX & TOTALS LOGIC
        const invoiceLines = data.hms_invoice_lines || data.items || [];
        const subtotalValue = invoiceLines.reduce((acc: number, item: any) => acc + Number(item.net_amount || item.total || 0), 0);
        const taxValue = Number(data.tax_amount || 0);
        const grandTotal = Number(data.total_amount || data.net_amount || data.total || subtotalValue + taxValue);

        // Setting Awareness: default to showing tax if not explicitly disabled
        const showTaxDetails = config?.showTaxOnBill !== false;

        const bMeta = (() => {
            const m = data.billing_metadata;
            if (!m) return {};
            if (typeof m === 'string') {
                try { return JSON.parse(m); } catch (e) { return {}; }
            }
            return m;
        })();

        const resolvedPatientName = (() => {
            // 1. Metadata Discovery (Deep Search - HIGHEST PRIORITY for Walk-ins)
            const meta = bMeta || {};
            if (meta.patient_name) return meta.patient_name;
            if (meta.name) return meta.name;
            if (meta.customer_name) return meta.customer_name;

            // 2. Registered Patient Check
            const fromProfile = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
            if (fromProfile && fromProfile.length > 1) return fromProfile;

            // 3. Top-Level Discovery (Failsafe)
            const d = (data as any) || {};
            if (d.patient_name) return d.patient_name;
            if (d.customer_name) return d.customer_name;
            if (d.customer) return d.customer;
            if (d.name) return d.name;
            
            return "Walk-in Patient";
        })();

        const resolvedPatientMobile = (() => {
            // 1. Metadata Discovery (Deep Search - HIGHEST PRIORITY for Walk-ins)
            const meta = bMeta || {};
            if (meta.patient_phone) return meta.patient_phone;
            if (meta.phone) return meta.phone;
            if (meta.mobile) return meta.mobile;
            if (meta.contact) return meta.contact;

            // 2. Registered Patient Check
            const fromProfile = (patientData.contact as any)?.phone || patientData.phone || (patientData.contact as any)?.mobile;
            if (fromProfile) return fromProfile;

            // 3. Top-Level Discovery (Failsafe)
            const d = (data as any) || {};
            if (d.patient_phone) return d.patient_phone;
            if (d.customer_phone) return d.customer_phone;
            if (d.phone) return d.phone;
            if (d.mobile) return d.mobile;
            
            return "N/A";
        })();

        const context = {
            ...companyData,
            ...meta,
            ...data,
            show_tax: showTaxDetails,
            bill_header_label: (usage === 'sales_return' || usage === 'purchase_return') ? (usage === 'purchase_return' ? "DEBIT NOTE / RETURN" : "CREDIT NOTE") : (usage === 'purchase_receipt' ? "GOODS RECEIVED NOTE (GRN)" : (showTaxDetails ? "TAX INVOICE" : "INVOICE")),
            subtotal: `Rs. ${subtotalValue.toFixed(2)}`,
            tax_amount: `Rs. ${taxValue.toFixed(2)}`,
            total_discount: `Rs. ${Number(data.total_discount || 0).toFixed(2)}`,
            total_amount: `Rs. ${Number(data.total_amount || data.total || 0).toFixed(2)}`,
            // [FORCE-CLEANUP] Standardize currency symbol for PDF rendering (Standard fonts use Rs.)
            currency_symbol: "Rs.",
            grand_total_label: (usage === 'sales_return' || usage === 'purchase_return') ? (usage === 'purchase_return' ? "DEBIT TOTAL (Rs.)" : "REFUND TOTAL (Rs.)") : (usage === 'purchase_receipt' ? "RECEIPT TOTAL (Rs.)" : "GRAND TOTAL (Rs.)"),
            doc_number: (usage === 'sales_return' || usage === 'purchase_return') ? (data.return_number || data.id?.slice(0, 8)) : (usage === 'purchase_receipt' ? (data.receipt_number || data.id?.slice(0, 8)) : (data.invoice_number || data.order_number || data.id?.slice(0, 8) || "N/A")),
            formatted_date: formatDate(
                data.created_at || Date.now(), 
                `${company.metadata?.date_format || DEFAULT_DATE_FORMAT} ${company.metadata?.time_format || DEFAULT_TIME_FORMAT}`
            ),
            company: {
                ...companyData,
                name: companyData.name || meta.hospital_name || "",
                address: companyData.address || meta.address || "",
                phone: companyData.phone || meta.phone || meta.mobile || "",
                email: companyData.email || meta.email || "",
            },
            patient: {
                ...patientData,
                name: resolvedPatientName,
                phone: resolvedPatientMobile,
                id: patientData.patient_number || patientData.id,
                age: (() => {
                    if (patientData.age) return patientData.age;
                    if (patientData.dob) {
                        const birth = new Date(patientData.dob);
                        const today = new Date();
                        let age = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                        return age;
                    }
                    return "N/A";
                })(),
                renew_date: (() => {
                    const storedExpiry = patientData.metadata?.registration_expiry;
                    if (!storedExpiry || isNaN(new Date(storedExpiry).getTime())) return "N/A";
                    
                    const d = new Date(storedExpiry);
                    // [POLICY-FIX] Force 7-day (or setting-defined) window from patient creation
                    const createdAt = patientData.created_at ? new Date(patientData.created_at) : new Date();
                    const validityDays = hmsSettings?.registrationValidity || 7;
                    const policyExpiry = new Date(createdAt);
                    policyExpiry.setDate(policyExpiry.getDate() + Number(validityDays));
                    
                    const finalDate = (d.getFullYear() > policyExpiry.getFullYear() + 1) ? policyExpiry : d;
                    return formatDate(finalDate, company.metadata?.date_format || DEFAULT_DATE_FORMAT);
                })(),
                mobile: (() => {
                    const m = String(resolvedPatientMobile).replace(/\D/g, '');
                    if (m.length === 10) return m.slice(0, 5) + '   ' + m.slice(5);
                    return resolvedPatientMobile;
                })(),
                address: (() => {
                    const rawAddr = patientData.address || (typeof patientData.contact === 'object' ? (patientData.contact as any)?.address : null);
                    if (typeof rawAddr === 'string') return rawAddr;
                    if (rawAddr && typeof rawAddr === 'object') {
                        const parts = [(rawAddr as any).line1, (rawAddr as any).line2, (rawAddr as any).city, (rawAddr as any).state, (rawAddr as any).pincode].filter(Boolean);
                        if (parts.length > 0) return parts.join(', ');
                        return Object.values(rawAddr).filter(v => typeof v === 'string').join(', ');
                    }
                    return "Address Not Recorded";
                })(),
            },
        };
        // [FINAL-AUTHORITY-INJECTION] 
        // Ensure that resolved identity always wins, preventing "Walk-in Patient" placeholders
        context.patient_name = resolvedPatientName;
        context.patient_mobile = resolvedPatientMobile;
        context.customer_name = resolvedPatientName;
        context.customer_phone = resolvedPatientMobile;
        context.patient = {
            ...context.patient,
            name: resolvedPatientName,
            phone: resolvedPatientMobile
        };

        const rawDocFirst = clinicianData.first_name || (clinicianData.user as any)?.name || clinicianData.name || "";
        const rawDocLast = clinicianData.last_name || "";
        const resolvedDocName = rawDocFirst ? `${clinicianData.salutation || 'Dr.'} ${rawDocFirst} ${rawDocLast}`.trim() : "Consulting Physician / Medical Officer";

        context.doctor = {
            ...clinicianData,
            registration_number: clinicianData.license_no || clinicianData.registration_number || (clinicianData.metadata as any)?.registration_number || "REG-PENDING",
            department: (clinicianData.hms_specializations as any)?.name || (clinicianData.metadata as any)?.department || "General Practice",
            designation: clinicianData.designation || "Consultant",
            qualification: clinicianData.qualification || "",
            doctor_name: resolvedDocName,
            doctor_notes: clinicianData.notes || (clinicianData.designation ? `${clinicianData.designation} | ${clinicianData.qualification || ''}` : ""),
            footer_text: clinicianData.notes || (clinicianData.designation ? `${clinicianData.designation} | ${clinicianData.qualification || ''}` : "Consulting Physician / Medical Officer"),
            digital_print_footer: clinicianData.notes || ""
        };
        context.visit = {
            starts_at: appointmentData.starts_at ? formatDate(
                appointmentData.starts_at, 
                `${company.metadata?.date_format || DEFAULT_DATE_FORMAT} ${company.metadata?.time_format || DEFAULT_TIME_FORMAT}`
            ) : "TBD"
        };
        context.token_number = appointmentData.token_number ? String(appointmentData.token_number).padStart(2, '0') : "01";
        context.doctor_name = resolvedDocName;

        const logoUrl = companyData.logo_url || meta.logo_url;

        const hexToRgb = (hex: string) => {
            if (!hex || hex === 'transparent' || hex === 'None') return null;
            const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return res ? { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) } : null;
        };

        const fetchAsset = async (url: string): Promise<string | null> => {
            try {
                if (!url) return null;
                if (url.startsWith('data:')) return url;
                const res = await fetch(url);
                const arrayBuffer = await res.arrayBuffer();
                return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
            } catch (err) {
                console.error("[ENGINE] Asset Load Fail:", url, err);
                return null;
            }
        };

        const fetchQr = async (text: string) => {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
            return await fetchAsset(url);
        };

        // 1. Process Elements (SORTED BY Y-POSITION FOR LOGICAL FLOW)
        const elements = Object.entries(coords).sort((a: any, b: any) => (a[1]?.y || 0) - (b[1]?.y || 0));

        // [SURGICAL RENDER LOOP]
        let tableStartY = 0;
        let tableEndOfTableY = 0;
        const tableCfg = (coords.table || coords.hms_table);
        if (tableCfg) tableStartY = (tableCfg.y || 0) * scale;
        
        let hasRenderedIdentity = false;

        for (const [key, val] of elements as [string, any][]) {
            try {
                if (val.showSection === false) continue;

                // [REFINED SUPPRESSION] ONLY block the specific fields we've hardcoded to prevent overlap
                const isIdentityElement = (key === 'patient_id' || key === 'patient_name' || key === 'patient_age' || key === 'mobile_number' || key === 'patient_addr' || key === 'age_gender' || key === 'renew_date' || key === 'patient_mob');

                if (usage === 'op_slip' && isIdentityElement) {
                    if (key === 'patient_id' || key === 'patient_name' || key.includes('id')) {
                        // [WALK-IN-RECOVERY-LOGIC] Robustly resolve walk-in status from initial invoice data
                        const resolvedWalkInData = useMemo(() => {
                          const inv = JSON.parse(JSON.stringify(initialInvoice || activeInvoice || {}));
                          if (!inv || Object.keys(inv).length === 0) return { isWalkIn: false, name: '', phone: '' };
                          const hasPatientLink = inv.patient_id && String(inv.patient_id).length > 5;
                          if (hasPatientLink) return { isWalkIn: false, name: '', phone: '' };
                          try {
                              const m = inv.billing_metadata;
                              const bMeta = typeof m === 'string' ? JSON.parse(m) : (m || {});
                              const name = bMeta.patient_name || bMeta.name || inv.patient_name || '';
                              const phone = bMeta.patient_phone || bMeta.phone || inv.patient_phone || '';
                              const isWalkIn = Boolean(bMeta.is_walk_in || name || phone);
                              return { isWalkIn, name, phone };
                          } catch (e) {
                              return { isWalkIn: false, name: '', phone: '' };
                          }
                        }, [initialInvoice, activeInvoice]);

                        const [isWalkIn, setIsWalkIn] = useState(resolvedWalkInData.isWalkIn);
                        // Handled once at the core identity block...
                    }
                }

                // [LOCKED-FORMAT: 2026-04-22] - CLINICAL FIDELITY GUARD
                // This block hardcodes the patient identity to prevent accidental Branding Studio shifts.
                if (usage === 'op_slip' && isIdentityElement) {
                    if (!hasRenderedIdentity) {
                        const defaults = WORLD_STANDARD_DEFAULTS.op_slip;

                        // 1. Patient Name
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(12 * scale); 
                        doc.setTextColor(0, 0, 0);
                        doc.text(context.patient_name, defaults.patient_name.x * scale, 115 * scale);

                        // 2. Patient Age & Gender
                        doc.setFontSize(11 * scale);
                        doc.text(`${context.patient.age || "N/A"} / ${context.patient.gender || "N/A"}`, (defaults.age_gender?.x || 40) * scale, 128 * scale);

                        // 3. Row 2: Patient ID | Renew Date
                        doc.setFontSize(11 * scale);
                        doc.text(`ID: ${patientData.patient_number || patientData.id}`, (defaults.patient_id?.x || 40) * scale, 148 * scale);
                        
                        doc.setFontSize(9 * scale);
                        doc.text(`Renew Date: ${context.patient.renew_date}`, (defaults.renew_date?.x || 160) * scale, 148 * scale);

                        // 4. Row 3: Mobile Number | Address
                        const mobY = 158 * scale;
                        const mobX = (defaults.patient_mob?.x || 40) * scale;

                        doc.setTextColor(0, 0, 0);
                        doc.setFontSize(11 * scale);
                        const rawPhone = (patientData.contact?.phone || patientData.phone || "N/A").toString();
                        doc.text(`Mob: ${rawPhone}`, mobX, mobY);

                        if (context.patient.address) {
                            const addrX = (defaults.patient_addr?.x || 160) * scale;
                            doc.setFontSize(7.5 * scale);
                            doc.text(`Addr: ${context.patient.address}`, addrX, mobY, { maxWidth: 200 * scale });
                        }
                        
                        hasRenderedIdentity = true;
                    }
                    continue; 
                }

                // [FORCE-FIDELITY] Move Clinical Line to appropriate vertical anchor
                if (usage === 'op_slip' && key === 'line_1_btm') {
                    val.y = 185;
                }

                // [FORCE-FIDELITY] Move Vitals to Vertical Right Sidebar
                if (usage === 'op_slip' && (key === 'notes_hdr' || key === 'vitals_row')) {
                    if (key === 'notes_hdr') {
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(8 * scale);
                        doc.setTextColor(148, 163, 184); 
                        doc.text("CLINICAL VITALS", 470 * scale, 195 * scale);
                    }
                    
                    if (key === 'vitals_row') {
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(9 * scale);
                        doc.setTextColor(0, 0, 0);
                        const vitals = ["BP:", "SPO2:", "PR:", "RR:", "GRBS:", "WT:", "TEMP:"];
                        let vY = 212;
                        vitals.forEach(v => {
                            doc.text(v, 470 * scale, vY * scale);
                            // Draw entry line next to label
                            doc.setDrawColor(203, 213, 225); // slate-200
                            doc.setLineWidth(0.5 * scale);
                            doc.line(505 * scale, vY * scale, 560 * scale, vY * scale);
                            vY += 35; // Significantly increased vertical spacing for maximum writing room
                        });
                    }
                    continue;
                }


                const x = (val.x || 0) * scale;
                let y = (val.y || 0) * scale;

                // DYNAMIC POSITIONING: If this element started below the table, shift it by the table's actual growth
                // [USER-REQUEST] Broad suppression for all footer, signature, and bottom-notes in sale bills
                const isBottomElement = key.toLowerCase().includes('footer') || key.toLowerCase().includes('sign') || key.toLowerCase().includes('signature') || key.toLowerCase().includes('notes') || key.toLowerCase().includes('terms');
                if (usage === 'sale_bill' && isBottomElement) {
                    continue;
                }

                if (key === 'footer' || key === 'footer_line') {
                    // Position footer relative to page bottom safely above physical unprintable printer margin
                    y = pageHeight - (75 * scale);
                    if (key === 'footer_line') y -= (10 * scale);
                } else if (tableEndOfTableY > 0 && (val.y * scale) > tableStartY) {
                    const originalGap = (val.y * scale) - tableStartY;
                    y = tableEndOfTableY + originalGap - (20 * scale); // Maintain relative relationship
                }

                // INTELLIGENT WRAP PROTECTION: Only add page if we are EXCEEDING the current page boundary
                const isFooterElement = key.toLowerCase().includes('footer') || key.toLowerCase().includes('qr') || key.toLowerCase().includes('notes_box');
                const pageThreshold = isFooterElement ? (835 * scale) : (785 * scale);

                if (y > pageThreshold && !isFooterElement) {
                    doc.addPage();
                    y = (60 * scale); // Top margin
                    tableEndOfTableY = (60 * scale); // Anchor future elements to this new top
                    tableStartY = 0; // Prevent runaway offsets on the new page
                }

                // A. LOGO
                if (key === 'logo' || val.type === 'logo') {
                    const img = await fetchAsset(logoUrl);
                    if (img) {
                        const w = (val.width || val.size || config.logoSize || 80) * scale;
                        doc.addImage(img, 'PNG', x, y, w, w);
                    }
                    continue; // Fix: Prevent double rendering as text
                }
                // B. QR CODE
                else if (val.type === 'qr' || key.startsWith('qr_') || key === 'qr') {
                    const qrText = compileTemplate(val.label || data.id, context);
                    const qrImg = await fetchQr(qrText);
                    if (qrImg) {
                        const w = (val.width || 60) * scale;
                        doc.addImage(qrImg, 'PNG', x, y, w, w);
                    }
                    continue; // Fix: Prevent double rendering as text
                }
                // C. LINE / DIVIDER
                else if (val.type === 'line' || key.startsWith('line_')) {
                    const x2 = (val.x2 || 555) * scale;
                    let y2 = (val.y2 || val.y || 0) * scale;

                    // Shift the line if it was originally below the table
                    if (tableEndOfTableY > 0 && (val.y * scale) > tableStartY) {
                        const effectiveY2 = (val.y2 || val.y || 0);
                        const originalGap2 = (effectiveY2 * scale) - tableStartY;
                        y2 = tableEndOfTableY + originalGap2 - (20 * scale);
                    }

                    const color = hexToRgb(val.color || (key === 'footer_line' ? '#64748b' : '#cbd5e1'));
                    const thick = (val.thickness || 0.5) * scale;

                    if (color) doc.setDrawColor(color.r, color.g, color.b);
                    doc.setLineWidth(thick);
                    doc.line(x, y, x2, y2);
                    continue; // Fix: Prevent double rendering as text
                }
                // D. TABLE (Dynamic Lists)
                else if (key === 'table' || val.type === 'table') {
                    tableEndOfTableY = await renderTable(doc, usage, data, val, scale, pageWidth, pageHeight, context);
                    continue;
                }
                // E. TEXT & BOX ELEMENTS
                else {
                    const bgColor = hexToRgb(val.backgroundColor);
                    const strokeColor = hexToRgb(val.stroke);

                    if (bgColor || strokeColor || val.height) {
                        if (bgColor) doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
                        if (strokeColor) doc.setDrawColor(strokeColor.r, strokeColor.g, strokeColor.b);

                        const p = (val.padding || 0) * scale;
                        const w = (val.width || 100) * scale;
                        const h = (val.height || ((val.fontSize || 10) + 10)) * scale;

                        const style = (bgColor && strokeColor) ? 'FD' : (bgColor ? 'F' : 'S');
                        doc.rect(x - p, y - p, w, h, style);
                    }

                    const label = val.label || '';
                    if (!label && key !== 'name' && key !== 'hosp_name') continue;

                    const compiledText = compileTemplate(label, context);
                    if (!compiledText && !label.includes('Hospital')) continue;

                    const isHospName = key === 'name' || key === 'hosp_name';
                    doc.setFontSize((val.fontSize || 10) * scale);
                    const isBold = val.fontWeight === 'bold' || val.fontWeight === '900' || val.fontWeight === '700';
                    const font = val.fontType || (isHospName ? (config.hospitalNameFont || "times") : "times");
                    doc.setFont(font, isBold ? "bold" : "normal");

                    const color = hexToRgb(val.color || (isHospName ? (config.hospitalNameColor || "#000000") : "#000000"));
                    if (color) doc.setTextColor(color.r, color.g, color.b);

                    const charSpacing = val.letterSpacing || (isHospName ? (config.hospitalNameLetterSpacing || 0) : 0);
                    if (charSpacing) (doc as any).setCharSpace(charSpacing);

                    const options: any = { baseline: 'top' };
                    if (val.align === 'center') options.align = 'center';
                    else if (val.align === 'right') options.align = 'right';

                    if (val.width) {
                        options.maxWidth = val.width * scale;
                    }

                    // --- SMART MULTILINE & ICON RENDERER ---
                    const maxWidth = (val.width || 500) * scale;
                    let currentY = y;

                    // SMART SIGNATURE LAYER: If we are rendering the doctor's footer notes,
                    // we automatically prepend the Doctor's Name in a larger, bold font.
                    const isDoctorNotes = (usage === 'op_slip' && (key === 'footer' || key === 'signature' || key === 'doc_notes' || key === 'qualification'));
 
                    if (isDoctorNotes) {
                        // Official high-fidelity clinical stamp
                        const boxWidth = 220 * scale; 
                        const centerX = pageWidth - (boxWidth / 2) - (40 * scale);
                        
                        let cleanName = (context.doctor?.doctor_name || "").toUpperCase();
                        if (cleanName.includes("UNDEFINED") || !cleanName || cleanName.trim() === "DR.") {
                            cleanName = "MEDICAL OFFICER";
                        }
                        const qualification = (context.doctor?.digital_print_footer || context.doctor?.footer_text || "Consulting Physician / Medical Officer").trim();
                        
                        // Split multi-line strings explicitly to ensure perfect rendering of master form data
                        const splitQual = qualification && qualification.toUpperCase() !== cleanName && !qualification.includes("undefined")
                            ? doc.splitTextToSize(qualification, boxWidth)
                            : [];
                        
                        // DYNAMIC LIFT: Calculate the total height of all footer lines
                        // Anchor the entire block so its absolute bottom rests safely at pageHeight - (45 * scale)
                        const totalQualHeight = splitQual.length * (11 * scale);
                        const bottomSafeAnchor = pageHeight - (45 * scale);
                        const stampTopY = Math.min(currentY, bottomSafeAnchor - totalQualHeight - (16 * scale));

                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(10 * scale);
                        doc.text(cleanName, centerX, stampTopY, { align: 'center', baseline: 'top' });
                        
                        if (splitQual.length > 0) {
                            doc.setFont("times", "italic");
                            doc.setFontSize(8 * scale);
                            
                            let qualY = stampTopY + (14 * scale);
                            splitQual.forEach((line: string) => {
                                doc.text(line, centerX, qualY, { align: 'center', baseline: 'top' });
                                qualY += (11 * scale);
                            });
                        }
                        continue; 
                    }

                    // Robust multi-line splitting (Preserves manual \n while handling auto-wrap)
                    const rawLines = compiledText.split('\n');
                    const lines: string[] = [];
                    rawLines.forEach(rl => {
                        lines.push(...doc.splitTextToSize(rl, maxWidth));
                    });

                    const lineHeight = (isDoctorNotes ? 9 : (val.fontSize || 10)) * 1.35 * scale;

                    lines.forEach(line => {
                        if (line.includes('☎') || line.includes('✉') || line.includes('✆')) {
                            let currentX = x;
                            const parts = line.split(/([☎✉✆])/);
                            parts.forEach(part => {
                                if (part === '☎' || part === '✆') {
                                    doc.setTextColor(220, 38, 38); // Signature Red
                                    doc.setFont("helvetica", "bold");
                                    doc.setFontSize((val.fontSize || 11) * scale);
                                    doc.text("(P)", currentX, currentY, options);
                                    currentX += doc.getTextWidth("(P)") + (2 * scale);
                                } else {
                                    if (color) doc.setTextColor(color.r, color.g, color.b);
                                    doc.setFont("helvetica", "bold");
                                    doc.setFontSize((val.fontSize || 11) * scale);
                                    doc.text(part, currentX, currentY, options);
                                    currentX += doc.getTextWidth(part);
                                }
                            });
                        } else {
                            if (color) doc.setTextColor(color.r, color.g, color.b);
                            doc.text(line, x, currentY, options);
                        }
                        currentY += lineHeight;
                    });
                }
            } catch (elemErr) {
                console.error(`[ENGINE] Element Failure [${key}]:`, elemErr);
            }
        }

        if (autoPrint) doc.autoPrint({ variant: 'non-conform' });

        const output = doc.output('datauristring');
        console.log(`[ENGINE] Success. Output length: ${output.length}`);
        return output.split(',')[1];

    } catch (err) {
        console.error("FATAL UNIVERSAL PDF ENGINE FAILURE:", err);
        throw err;
    }
}

async function renderTable(doc: jsPDF, usage: string, data: any, tableConfig: any, scale: number, pageWidth: number, pageHeight: number, context: any) {
    const margin = (tableConfig.x || 40) * scale;
    const bottomMargin = (usage === 'sale_bill' ? 80 : 180) * scale; // REDUCED BUFFER FOR SALE BILL (NO FOOTER)
    let currentY = (tableConfig.y || 250) * scale;
    const rowHeight = 22 * scale;
    const fontSize = (tableConfig.fontSize || 9) * scale;

    let rawItems = (usage === 'prescription')
        ? (data.medicines || data.prescription?.[0]?.medicines || [])
        : (data.hms_invoice_lines || data.items || data.hms_lab_order_line || []);

    // Filter out ghost rows/empty inputs saved by older versions
    const items = rawItems.filter((i: any) => i.hms_product_id || i.product_id || i.description || i.medicine_id || (i.name && i.name !== ''));

    const qtyX = (tableConfig.qtyX || 380) * scale;
    const rateX = (tableConfig.rateX || 470) * scale;
    const totalX = (tableConfig.totalX || 555) * scale;

    const addPaging = () => {
        if (usage === 'sale_bill') return; // [USER-REQUEST] No footer/paging for bills
        const pageNum = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7 * scale);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - (20 * scale), { align: 'right' });
    };

    const renderContinuationHeader = () => {
        const pageNum = (doc as any).internal.getNumberOfPages();
        if (pageNum > 1) {
            doc.setFontSize(7 * scale);
            doc.setTextColor(100, 116, 139);
            const docNum = data.invoice_number || data.doc_number || data.id || "Document";
            const dateStr = data.created_at ? new Date(data.created_at).toLocaleDateString() : "";
            doc.text(`${docNum} | ${dateStr}`, margin, margin - (15 * scale));
            doc.text(`Continuation Sheet`, pageWidth / 2, margin - (15 * scale), { align: 'center' });
        }
    };

    const renderHeader = (y: number) => {
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(1 * scale);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
        doc.setFontSize(fontSize + 1);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);

        const textY = y + (15 * scale);
        doc.text('#', margin + (5 * scale), textY);

        if (usage === 'prescription') {
            doc.text('MEDICATION', margin + (35 * scale), textY);
            doc.text('DOSAGE', qtyX, textY, { align: 'center' });
            doc.text('PERIOD', rateX, textY, { align: 'right' });
            doc.text('TIMING', totalX, textY, { align: 'right' });
        } else if (usage === 'lab_report') {
            doc.text('INVESTIGATION', margin + (35 * scale), textY);
            doc.text('RESULT', qtyX, textY, { align: 'center' });
            doc.text('UNIT', rateX, textY, { align: 'right' });
            doc.text('REF. RANGE', totalX, textY, { align: 'right' });
        } else {
            doc.text('DESCRIPTION', margin + (35 * scale), textY);
            doc.text('QTY', qtyX, textY, { align: 'center' });
            doc.text('RATE', rateX, textY, { align: 'right' });
            doc.text('TOTAL', totalX, textY, { align: 'right' });
        }

        return y + rowHeight;
    };

    addPaging();
    currentY = renderHeader(currentY);

    items.forEach((item: any, idx: number) => {
        if (currentY + rowHeight > pageHeight - bottomMargin) {
            // INDICATOR: Continued on next page
            doc.setFontSize(7 * scale);
            doc.setTextColor(148, 163, 184);
            doc.text("Continued on next page...", pageWidth / 2, pageHeight - (bottomMargin - 10 * scale), { align: 'center' });

            doc.addPage();
            addPaging();
            renderContinuationHeader();
            currentY = renderHeader(margin);
        }

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');

        const textY = currentY + (15 * scale);
        doc.text(String(idx + 1), margin + (5 * scale), textY);

        if (usage === 'prescription') {
            const name = (item.hms_product?.name || item.name || "Generic Medicine").toUpperCase();
            const dosage = item.dosage || `${item.morning || 0}-${item.afternoon || 0}-${item.evening || 0}-${item.night || 0}`;
            doc.text(name, margin + (35 * scale), textY);
            doc.text(dosage, qtyX, textY, { align: 'center' });
            doc.text(`${item.days || item.duration || '-'} Days`, rateX, textY, { align: 'right' });
            doc.text(item.timing || 'Post-Meal', totalX, textY, { align: 'right' });
        } else if (usage === 'lab_report') {
            const name = (item.hms_lab_test?.name || item.description || "Lab Investigation").toUpperCase();
            const result = item.metadata?.result || item.result || "-";
            const unit = item.hms_lab_test?.units || item.unit || "";
            const range = item.hms_lab_test?.reference_range || item.range || "-";
            
            doc.text(name, margin + (35 * scale), textY);
            doc.text(String(result), qtyX, textY, { align: 'center' });
            doc.text(String(unit), rateX, textY, { align: 'right' });
            doc.text(typeof range === 'string' ? range : JSON.stringify(range), totalX, textY, { align: 'right' });
        } else {
            const description = (item.hms_product?.name || item.description || "Medical Service").toUpperCase();
            doc.text(description.length > 40 ? description.substring(0, 37) + '...' : description, margin + (35 * scale), textY);

            doc.text(String(item.quantity || 1), qtyX, textY, { align: 'center' });
            doc.text(Number(item.unit_price || item.rate || 0).toFixed(2), rateX, textY, { align: 'right' });
            doc.text(Number(item.net_amount || item.total || 0).toFixed(2), totalX, textY, { align: 'right' });
        }

        currentY += rowHeight;
    });

    // --- FINANCIAL BREAKDOWN (World Class Summary) ---
    if (usage === 'sale_bill' || usage === 'sales_return' || usage === 'purchase_return' || usage === 'purchase_receipt') {
        const totalDiscount = Number(data.total_discount || 0);
        const totalTax = Number(data.total_tax || data.tax_amount || 0);
        const subtotal = Number(data.subtotal || 0);

        if (totalTax > 0 || totalDiscount > 0) {
            currentY += 5 * scale;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5 * scale);
            doc.line(margin + (200 * scale), currentY, totalX, currentY);
            currentY += 15 * scale;

            doc.setFontSize(fontSize - 1);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);

            // Always show Subtotal if we have either tax or discount to provide "Before" context
            const subtotalLabel = totalDiscount > 0 ? "TOTAL BEFORE DISCOUNT:" : (totalTax > 0 ? "SUBTOTAL (TAXABLE VALUE):" : "SUBTOTAL:");
            doc.text(subtotalLabel, margin + (200 * scale), currentY, { align: 'left' });
            doc.text(`${context.currency_symbol} ${subtotal.toFixed(2)}`, totalX, currentY, { align: 'right' });
            currentY += 15 * scale;

            if (totalTax > 0) {
                doc.text("TOTAL TAX:", margin + (200 * scale), currentY, { align: 'left' });
                doc.text(`${context.currency_symbol} ${totalTax.toFixed(2)}`, totalX, currentY, { align: 'right' });
                currentY += 15 * scale;
            }

            if (totalDiscount > 0) {
                doc.setTextColor(185, 28, 28); // rose-700
                doc.text("TOTAL DISCOUNT:", rateX, currentY, { align: 'right' });
                doc.text(`- ${totalDiscount.toFixed(2)}`, totalX, currentY, { align: 'right' });
                currentY += 15 * scale;
                doc.setTextColor(0, 0, 0);
            }
        }
    }

    return currentY;
}
