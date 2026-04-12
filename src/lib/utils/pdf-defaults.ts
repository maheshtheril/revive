/**
 * WORLD STANDARD PDF DEFAULTS
 * High-fidelity, coordinate-aware presets for different hospital document categories.
 * These are used as the "Starting Point" for any new template.
 */

export const WORLD_STANDARD_DEFAULTS: Record<string, any> = {
    sale_bill: {
        logo: { x: 50, y: 50, showSection: true },
        name: { x: 150, y: 50, fontSize: 24, fontWeight: '900', letterSpacing: -1, showSection: true },
        address: { x: 150, y: 85, fontSize: 10, fontWeight: '700', width: 300, showSection: true },
        phone: { x: 150, y: 120, fontSize: 9, fontWeight: '700', showSection: true },
        email: { x: 150, y: 135, fontSize: 9, fontWeight: '700', showSection: true },
        docTitle: { x: 520, y: 50, label: 'SERVICE INVOICE', backgroundColor: '#000000', color: '#ffffff', padding: 12, fontSize: 11, fontWeight: '900', showSection: true },
        docId: { x: 520, y: 100, label: 'Doc #', fontSize: 16, fontWeight: '900', showSection: true },
        docDate: { x: 520, y: 125, fontSize: 9, fontWeight: '700', showSection: true },
        token: { x: 520, y: 150, label: 'Token #', fontSize: 24, fontWeight: '900', color: '#059669', showSection: true },
        patientTitle: { x: 50, y: 220, label: 'Recipient Information', fontSize: 9, fontWeight: '900', color: '#94a3b8', showSection: true },
        patientName: { x: 50, y: 240, label: 'Patient Name', fontSize: 20, fontWeight: '900', showSection: true },
        patientId: { x: 50, y: 275, label: 'MRN:', fontSize: 10, fontWeight: '700', showSection: true },
        patientAgeGender: { x: 180, y: 275, label: 'Age/Gender:', fontSize: 10, fontWeight: '700', showSection: true },
        doctor: { x: 50, y: 310, label: 'Consulting Doctor:', fontSize: 12, fontWeight: '900', showSection: false },
        department: { x: 50, y: 345, label: 'Department:', fontSize: 9, fontWeight: '800', showSection: false },
        table: { x: 50, y: 450, showSection: true, qtyX: 320, rateX: 420, totalX: 780 },
        subtotal: { x: 500, y: 720, label: 'Subtotal:', fontSize: 10, fontWeight: '700', showSection: true },
        tax: { x: 500, y: 745, label: 'Tax:', fontSize: 10, fontWeight: '700', showSection: true },
        total: { x: 500, y: 780, label: 'Total Payable:', backgroundColor: '#4f46e5', color: '#ffffff', padding: 16, fontSize: 14, fontWeight: '900', showSection: true },
        bank: { x: 50, y: 730, label: 'Ziona National Bank | Acc: 90082771 | IFSC: ZION001', showSection: true, fontSize: 10, fontWeight: '700' },
        qr: { x: 350, y: 730, showSection: true },
        preparedBy: { x: 50, y: 920, label: 'Prepared By:', fontSize: 9, fontWeight: '700', showSection: true },
        disclaimer: { x: 50, y: 950, label: 'NB: Computer-generated document. No signature required.', fontSize: 8, fontWeight: '600', width: 700, showSection: true },
        footer: { x: 250, y: 1000, showSection: true }
    },
    op_slip: {
        logo: { x: 50, y: 50, showSection: true },
        name: { x: 150, y: 50, fontSize: 24, fontWeight: '900', letterSpacing: -1, showSection: true },
        address: { x: 150, y: 85, fontSize: 10, fontWeight: '700', width: 300, showSection: true },
        phone: { x: 150, y: 120, fontSize: 9, fontWeight: '700', showSection: true },
        email: { x: 150, y: 135, fontSize: 9, fontWeight: '700', showSection: true },
        docTitle: { x: 520, y: 50, label: 'OP REGISTRATION SLIP', backgroundColor: '#000000', color: '#ffffff', padding: 12, fontSize: 11, fontWeight: '900', showSection: true },
        token: { x: 520, y: 100, label: 'Token #', fontSize: 40, fontWeight: '950', color: '#059669', showSection: true },
        docId: { x: 520, y: 135, label: 'Visit ID:', fontSize: 8, fontWeight: '400', showSection: true },
        docDate: { x: 520, y: 155, showTime: true, fontSize: 9, fontWeight: '700', showSection: true },
        patientName: { x: 50, y: 200, label: 'Patient Name:', fontSize: 20, fontWeight: '900', showSection: true },
        patientId: { x: 50, y: 230, label: 'MRN:', fontSize: 10, fontWeight: '700', showSection: true },
        patientDemographics: { x: 50, y: 245, label: 'Age/Gender:', fontSize: 10, fontWeight: '700', showSection: true },
        doctor: { x: 50, y: 310, label: 'Consultant:', fontSize: 18, fontWeight: '900', color: '#0f172a', showSection: true },
        department: { x: 50, y: 345, label: 'Clinic/Dept:', fontSize: 9, fontWeight: '900', color: '#059669', showSection: true },
        vitalBP: { x: 520, y: 200, label: 'BP (mmHg)', fontSize: 10, fontWeight: '700', showSection: true },
        vitalPulse: { x: 620, y: 200, label: 'Pulse (bpm)', fontSize: 10, fontWeight: '700', showSection: true },
        vitalTemp: { x: 520, y: 250, label: 'Temp (ºF)', fontSize: 10, fontWeight: '700', showSection: true },
        vitalWeight: { x: 620, y: 250, label: 'Weight (kg)', fontSize: 10, fontWeight: '700', showSection: true },
        vitalSpo2: { x: 520, y: 280, label: 'SpO2 (%)', fontSize: 10, fontWeight: '700', showSection: true },
        labTests: { x: 520, y: 350, label: 'Investigations Ordered:', fontSize: 10, fontWeight: '900', width: 230, showSection: true },
        rxSymbol: { x: 50, y: 400, label: '℞', fontSize: 60, fontWeight: '900', color: '#000', showSection: true },
        notes: { x: 50, y: 900, label: 'Clinical Observations / Plan:', fontSize: 10, fontWeight: '700', width: 700, showSection: true },
        qr: { x: 520, y: 980, showSection: true },
        preparedBy: { x: 50, y: 1050, label: 'Issued By:', fontSize: 9, fontWeight: '700', showSection: true },
        footer: { x: 250, y: 1080, showSection: true }
    },
    prescription: {
        logo: { x: 50, y: 50, showSection: true },
        name: { x: 150, y: 50, fontSize: 24, fontWeight: '900', showSection: true },
        address: { x: 150, y: 85, fontSize: 10, fontWeight: '700', width: 300, showSection: true },
        phone: { x: 150, y: 120, fontSize: 9, fontWeight: '700', showSection: true },
        docTitle: { x: 520, y: 50, label: 'MEDICAL PRESCRIPTION', backgroundColor: '#059669', color: '#ffffff', padding: 12, fontSize: 11, fontWeight: '900', showSection: true },
        docDate: { x: 520, y: 85, showTime: true, fontSize: 9, fontWeight: '700', showSection: true },
        patientName: { x: 50, y: 200, label: 'Patient:', fontSize: 20, fontWeight: '900', showSection: true },
        patientId: { x: 50, y: 230, label: 'ID/MRN:', fontSize: 10, fontWeight: '700', showSection: true },
        patientDemographics: { x: 50, y: 245, label: 'Age/Gender:', fontSize: 10, fontWeight: '700', showSection: true },
        doctor: { x: 450, y: 200, label: 'DR. ALEXANDER FLEMING', fontSize: 12, fontWeight: '900', showSection: true },
        department: { x: 450, y: 220, label: 'PULMONOLOGY', fontSize: 9, fontWeight: '700', color: '#64748b', showSection: true },
        rxSymbol: { x: 50, y: 300, label: '℞', fontSize: 50, fontWeight: '900', color: '#000', showSection: true },
        table: { x: 50, y: 400, showSection: true, medicationX: 50, dosageX: 300, periodX: 450 },
        notes: { x: 50, y: 850, label: 'Special Instructions:', fontSize: 10, fontWeight: '700', width: 700, showSection: true },
        preparedBy: { x: 50, y: 1000, label: 'Doctor Signature:', fontSize: 10, fontWeight: '900', showSection: true },
        footer: { x: 250, y: 1050, showSection: true }
    }
};

export function getUsageDefault(usage: string) {
    const norm = usage.toLowerCase().trim().replace(/\s+/g, '_');
    return WORLD_STANDARD_DEFAULTS[norm] || WORLD_STANDARD_DEFAULTS.sale_bill;
}
