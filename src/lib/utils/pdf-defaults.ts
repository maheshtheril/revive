/**
 * WORLD STANDARD PDF DEFAULTS (v3)
 * High-fidelity, coordinate-aware presets for different hospital document categories.
 * Features a Case-Insensitive, Recursive Template Engine.
 */

export const SAMPLE_DATA = {
    patient: {
        fullname: "JOHN DOE",
        patient_number: "P-900827",
        blood_group: "O+ve",
        dob: "1982-05-12",
        age: "42Y",
        gender: "MALE",
        address: "7/221 HIGHLANDS, KERALA, INDIA",
        renew_date: "12-MAY-2025",
        mobile: "+91 98765 43210"
    },
    doctor: {
        name: "DR. ALEXANDER FLEMING",
        specialization: "PULMONOLOGY",
        registration_number: "KMC-123456",
        footer_text: "MD, Senior Consultant Cardiologist"
    },
    visit: {
        token_number: "08",
        starts_at: "16-04-2026 10:30 AM",
        type: "CONSULTATION",
        id: "VIS-2024-88A"
    },
    company: {
        name: "ELITE MEDICAL CENTER",
        address: "7/221 HOSPITAL ROAD, KERALA",
        email: "contact@elitemedical.com",
        phone: "+91 90000 12345",
        logo_url: "https://ui-avatars.com/api/?name=E+H&background=4f46e5&color=fff&size=128"
    }
};

/**
 * [CASE-INSENSITIVE - RECURSIVE ENGINE]
 * Resolves properties like {{patient.name}} regardless of casing
 */
export function compileTemplate(templateStr: string, context: any) {
    if (!templateStr) return '';
    
    // Create a normalized, flat map for one-level lookup
    const flatMap: Record<string, any> = {};
    const process = (obj: any, prefix = "") => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(k => {
            const val = obj[k];
            const p = prefix ? `${prefix}.${k}` : k;
            
            // Normalize key for zero-friction lookup
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanPath = p.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // If it's a simple value, store it
            if (val === null || val === undefined) {
                flatMap[cleanKey] = "";
                flatMap[cleanPath] = "";
            } else if (typeof val !== 'object') {
                flatMap[cleanKey] = val;
                flatMap[cleanPath] = val;
            } else if (Array.isArray(val)) {
                flatMap[cleanKey] = val.join(', ');
                flatMap[cleanPath] = val.join(', ');
            } else {
                // If it's an object (like address), flatten its values into a string for the parent key
                const objStr = Object.values(val).filter(v => v && typeof v !== 'object').join(', ');
                if (objStr) {
                    flatMap[cleanKey] = objStr;
                    flatMap[cleanPath] = objStr;
                }
                // Continue recursion
                process(val, p);
            }
        });
    };
    process(context);

    return templateStr.split('{{').flatMap((part, i) => {
        if (i === 0) return [part];
        const segments = part.split('}}');
        if (segments.length < 2) return ['{{' + part];
        const path = segments[0];
        const cleanPath = path.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const value = flatMap[cleanPath];
        return [(value === undefined || value === null ? '' : String(value)), segments.slice(1).join('}}')];
    }).join('');
}

/**
 * WORLD STANDARD COORDINATE PRESETS
 */
export const WORLD_STANDARD_DEFAULTS: Record<string, any> = {
    sale_bill: {
        // [BRANDING: Elite Hospital Identity - SYNCED WITH OP SLIP]
        logo: { x: 40, y: 25, width: 75 },
        name: { x: 125, y: 32, fontSize: 16, fontWeight: '900', label: "{{company.name}}" },
        hosp_info: { x: 125, y: 58, fontSize: 10, color: "#64748b", label: "{{company.address}}  |  Ph: {{company.phone}}  |  {{company.email}}", width: 400 },
        doc_title: { x: 555, y: 85, fontSize: 16, fontWeight: '900', color: "#1e293b", label: "{{bill_header_label}}", align: 'right' },
        line_hdr: { type: 'line', x: 40, y: 103, x2: 555, thickness: 1.5, color: '#1e293b' },
        
        // [BILLING & INVOICE ROW - PARALLEL ALIGNMENT - TIGHT]
        bill_to: { x: 40, y: 118, fontSize: 7, fontWeight: 'bold', label: "BILL TO:", color: "#64748b" },
        patient_name: { x: 40, y: 131, fontSize: 13, fontWeight: '900', label: "{{patient_name}}" },
        patient_id: { x: 40, y: 149, fontSize: 8, label: "Hosp ID: {{patient.patient_number}}" },
        patient_phone: { x: 40, y: 161, fontSize: 8, label: "Mob: {{patient.mobile}}" },
        
        inv_data_lbl: { x: 555, y: 118, fontSize: 7, fontWeight: 'bold', label: "INVOICE DETAILS:", align: 'right', color: "#64748b" },
        bill_no: { x: 555, y: 131, fontSize: 11, fontWeight: 'bold', label: "ID: {{doc_number}}", align: 'right' },
        date_hdr: { x: 555, y: 145, fontSize: 8, label: "Date: {{formatted_date}}", align: 'right' },

        // [MAIN TABLE]
        table: { x: 40, y: 178, fontSize: 9, headerFontSize: 10, showSection: true, qtyX: 380, rateX: 470, totalX: 555 },

        // [TOTALS FOOTER - SIMPLIFIED]
        line_btm: { type: 'line', x: 400, y: 200, x2: 555, thickness: 1 },
        total_lbl: { x: 460, y: 215, fontSize: 11, fontWeight: 'bold', label: "GRAND TOTAL:", align: 'right' },
        total_val: { x: 555, y: 215, fontSize: 16, fontWeight: '900', label: "{{total_amount}}", align: 'right' },
        
        footer: { x: 297, y: 750, fontSize: 7, label: "Computer Generated Invoice | Powered by Ziona HMS", align: 'center' }
    },
    purchase_receipt: {
        logo: { x: 40, y: 25, width: 75 },
        name: { x: 125, y: 32, fontSize: 16, fontWeight: '900', label: "{{company.name}}" },
        hosp_info: { x: 125, y: 58, fontSize: 10, color: "#64748b", label: "{{company.address}}  |  Ph: {{company.phone}}  |  {{company.email}}", width: 400 },
        
        doc_title: { x: 555, y: 85, fontSize: 16, fontWeight: '900', color: "#1e293b", label: "{{bill_header_label}}", align: 'right' },
        line_hdr: { type: 'line', x: 40, y: 103, x2: 555, thickness: 1.5, color: '#1e293b' },
        
        bill_to: { x: 40, y: 118, fontSize: 7, fontWeight: 'bold', label: "VENDOR / SUPPLIER:", color: "#64748b" },
        patient_name: { x: 40, y: 131, fontSize: 13, fontWeight: '900', label: "{{patient_name}}" },
        patient_phone: { x: 40, y: 149, fontSize: 8, label: "Contact / Ref: {{patient_phone}}" },
        
        inv_data_lbl: { x: 555, y: 118, fontSize: 7, fontWeight: 'bold', label: "GRN DETAILS:", align: 'right', color: "#64748b" },
        bill_no: { x: 555, y: 131, fontSize: 11, fontWeight: 'bold', label: "GRN #: {{doc_number}}", align: 'right' },
        date_hdr: { x: 555, y: 145, fontSize: 8, label: "Date: {{formatted_date}}", align: 'right' },

        table: { x: 40, y: 178, fontSize: 9, headerFontSize: 10, showSection: true, qtyX: 380, rateX: 470, totalX: 555 },

        line_btm: { type: 'line', x: 350, y: 200, x2: 555, thickness: 1 },
        total_lbl: { x: 460, y: 215, fontSize: 11, fontWeight: 'bold', label: "{{grand_total_label}}", align: 'right' },
        total_val: { x: 555, y: 215, fontSize: 16, fontWeight: '900', label: "{{total_amount}}", align: 'right' },
        
        footer: { x: 297, y: 750, fontSize: 7, label: "Computer Generated Goods Received Note | Powered by Ziona ERP", align: 'center' }
    },
    op_slip: {
        // [LOCKED-FORMAT: 2026-04-22] - DO NOT MODIFY WITHOUT MEDICAL DIRECTOR APPROVAL
        logo: { x: 40, y: 25, width: 75 },
        hosp_name: { x: 125, y: 32, fontSize: 16, fontWeight: '900', label: "{{company.name}}" },
        hosp_info: { x: 125, y: 58, fontSize: 10, color: "#475569", label: "{{company.address}}  •  Ph: {{company.phone}}  •  Email: {{company.email}}", width: 400 },
        
        token_box: { x: 505, y: 25, width: 60, height: 25, radius: 2, fill: "#f8fafc", stroke: "#e2e8f0", strokeWidth: 0.5 },
        token_label: { x: 535, y: 32, fontSize: 5, color: "#94a3b8", label: "TOKEN", align: 'center', fontWeight: 'bold' },
        token_val: { x: 535, y: 44, fontSize: 13, color: "#1e293b", fontWeight: '900', label: "{{token_number}}", align: 'center' },
        
        line_1: { type: 'line', x: 40, y: 103, x2: 565, thickness: 1, color: '#1e293b' },

        patient_name: { x: 40, y: 138, fontSize: 12, fontWeight: '900', label: "{{patient_name}}" },
        age_gender: { x: 40, y: 151, fontSize: 11, fontWeight: 'bold', label: "{{patient.age}} / {{patient.gender}}" },
        patient_id: { x: 40, y: 171, fontSize: 11, fontWeight: 'bold', label: "ID: {{patient.patient_number}}" },
        renew_date: { x: 160, y: 171, fontSize: 9, label: "Renew Date: {{patient.renew_date}}" },
        patient_mob: { x: 40, y: 181, fontSize: 11, fontWeight: 'bold', label: "Mob: {{patient.mobile}}" },
        patient_addr: { x: 160, y: 181, fontSize: 7.5, label: "Addr: {{patient.address}}", width: 200 },
        visit_time: { x: 555, y: 135, fontSize: 11, fontWeight: 'bold', align: 'right', label: "Visit Time: {{visit.starts_at}}" },

        line_1_btm: { type: 'line', x: 40, y: 215, x2: 565, thickness: 0.5, color: '#e2e8f0' },
        
        notes_hdr: { x: 470, y: 225, fontSize: 8, fontWeight: 'bold', color: '#94a3b8', label: "CLINICAL VITALS" },
        vitals_row: { x: 470, y: 242, fontSize: 9, label: "BP: ____ / ____" }, // Handled by engine loop
        
        footer: { x: 40, y: 760, fontSize: 10, width: 140, label: "{{doctor.footer_text}}", align: 'left' }
    },
    prescription: {
        logo: { x: 50, y: 50, showSection: true, width: 80 },
        name: { x: 150, y: 50, fontSize: 24, fontWeight: 'bold', showSection: true },
        address: { x: 150, y: 85, fontSize: 10, showSection: true },
        patient_hdr: { x: 50, y: 180, fontSize: 14, fontWeight: 'bold', label: "PATIENT: {{patient.fullname}}", showSection: true },
        doctor_hdr: { x: 400, y: 180, fontSize: 14, fontWeight: 'bold', label: "DOCTOR: {{doctor.name}}", showSection: true },
        rx_symbol: { x: 50, y: 250, fontSize: 40, fontWeight: 'bold', label: "℞", showSection: true },
        table: { x: 50, y: 320, showSection: true }
    },
    lab_report: {
        logo: { x: 50, y: 50, showSection: true, width: 80 },
        doc_title: { x: 400, y: 80, fontSize: 20, fontWeight: 'bold', label: "LABORATORY REPORT", align: 'center', showSection: true },
        patient_name: { x: 50, y: 180, fontSize: 12, label: "Name: {{patient.fullname}}", showSection: true },
        patient_id: { x: 50, y: 200, fontSize: 10, label: "ID: {{patient.patient_number}}", showSection: true },
        table: { x: 50, y: 280, showSection: true }
    },
    doctor_note: {
        logo: { x: 50, y: 50, showSection: true, width: 60 },
        doc_title: { x: 50, y: 140, fontSize: 18, fontWeight: 'bold', label: "CLINICAL NOTES", showSection: true },
        patient_info: { x: 50, y: 180, fontSize: 12, label: "Patient: {{patient.fullname}} ({{patient.patient_number}})", showSection: true },
        note_content: { x: 50, y: 220, fontSize: 11, label: "{{note.content}}", showSection: true, width: 500 }
    }
};

export function getUsageDefault(usage: string) {
    const norm = usage.toLowerCase().trim().split(' ').join('_');
    return WORLD_STANDARD_DEFAULTS[norm] || WORLD_STANDARD_DEFAULTS.sale_bill;
}
