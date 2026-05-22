import { Building2, Mail, Phone, Globe, MapPin, Landmark, QrCode } from "lucide-react";

interface PremiumPrintHeaderProps {
    company: {
        name: string;
        logo_url?: string | null;
        metadata?: any;
    };
    title: string;
    subtitle?: string;
    documentNumber: string;
    hide?: boolean;
    patient?: {
        name: string;
        id: string;
        ageGender?: string;
    };
    // New Props for Dynamic Control (from PDF settings)
    alignment?: 'left' | 'center' | 'right';
    showLogo?: boolean;
    hospitalNameSize?: number;
    addressSize?: number;
    showContactInfo?: boolean;
    hospitalPrimaryColor?: string;
    hospitalNameColor?: string;
    hospitalNameFont?: 'times' | 'helvetica';
    hospitalNameLetterSpacing?: number;
    logoLayout?: 'beside' | 'stack';
    logoPosition?: 'left' | 'center' | 'right';
    logoSize?: number;
    coordinates?: {
        logo?: { x: number, y: number, size?: number };
        name?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, backgroundColor?: string, padding?: number, borderRadius?: number, letterSpacing?: number, opacity?: number, label?: string };
        address?: { x: number, y: number, fontSize?: number, color?: string, width?: number, fontWeight?: string, opacity?: number, label?: string };
        contacts?: { x: number, y: number, color?: string, fontSize?: number, opacity?: number, label?: string };
        patientTitle?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        patientName?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number, letterSpacing?: number };
        patientId?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        patientAgeGender?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        patientDemographics?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        docTitle?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        docId?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        docDate?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        token?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        doctor?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        department?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        vitalBP?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        vitalPulse?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        vitalTemp?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        vitalWeight?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        vitalSpo2?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        rxSymbol?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        notes?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, opacity?: number };
        subtotal?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        tax?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        total?: { x: number, y: number, fontSize?: number, fontWeight?: string, color?: string, label?: string, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        table?: { x: number, y: number, qtyX?: number, rateX?: number, totalX?: number };
        bank?: { x: number, y: number, label?: string, fontSize?: number, fontWeight?: string, color?: string, showSection?: boolean, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        qr?: { x: number, y: number, showSection?: boolean, backgroundColor?: string, padding?: number, borderRadius?: number, opacity?: number };
        idBarcode?: { x: number, y: number, showSection?: boolean, opacity?: number };
        preparedBy?: { x: number, y: number, label?: string, fontSize?: number, fontWeight?: string, color?: string, opacity?: number };
        disclaimer?: { x: number, y: number, label?: string, fontSize?: number, fontWeight?: string, color?: string, opacity?: number, width?: number };
    };
    invoice?: any;
    prescription?: any;
}

export function PremiumPrintHeader({ 
    company, title, subtitle, documentNumber, hide = false,
    alignment = 'right', showLogo = true, hospitalNameSize = 18, 
    addressSize = 10, showContactInfo = true, hospitalPrimaryColor = '#4f46e5',
    hospitalNameColor = '#000000', hospitalNameFont = 'times', hospitalNameLetterSpacing = 0,
    logoLayout = 'beside', logoPosition = 'left', logoPositionVal = 'left', logoSize = 80,
    coordinates, patient, invoice, prescription
}: PremiumPrintHeaderProps & { logoPositionVal?: string }) {
    if (hide) return null;
    
    const metadata = company.metadata || {};
    const address = metadata.address || '';
    const email = metadata.email || '';
    const phone = metadata.phone || '';
    const website = metadata.website || '';
    const gstin = metadata.gstin || '';

    const isCenter = ['center'].includes(alignment as string);
    const isLeft = ['left'].includes(alignment as string);
    const isRight = ['right'].includes(alignment as string);

    // Layout Logic
    const isStack = logoLayout === 'stack';
    const anyLogoPosition = (logoPositionVal || logoPosition) as string;
    const isLogoRight = anyLogoPosition === 'right' && !isStack;
    const isLogoLeft = anyLogoPosition === 'left' && !isStack;
    const isLogoCenter = ['center'].includes(anyLogoPosition) || (isCenter && isStack);

    if (coordinates) {
        return (
            <div className="relative w-full print:bg-white overflow-visible" style={{ minHeight: '1px' }}>
                 {/* ATOMIC META RIBBON - Only show if not using draggable Doc Title/ID */}
                 {!coordinates.docTitle && (
                    <div className="absolute top-0 right-0 p-3 flex flex-col items-end z-[200]">
                        <div className="text-white px-6 py-2 rounded-xl mb-3 shadow-lg" style={{ backgroundColor: hospitalPrimaryColor }}>
                            <h2 className="text-sm font-black tracking-widest uppercase italic">{title}</h2>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Doc # <span className="text-slate-900 ml-1">{documentNumber}</span></p>
                    </div>
                 )}

                 {/* DRAGGABLE DOC METADATA */}
                 {coordinates.docTitle && (
                    <div className="absolute z-[200] whitespace-nowrap" style={{ 
                        left: `${coordinates.docTitle.x}px`, top: `${coordinates.docTitle.y}px`,
                        backgroundColor: coordinates.docTitle.backgroundColor || hospitalPrimaryColor,
                        padding: `${coordinates.docTitle.padding || 8}px`,
                        borderRadius: `${coordinates.docTitle.borderRadius || 4}px`,
                        color: coordinates.docTitle.color || '#fff'
                    }}>
                        <h2 className="font-black uppercase tracking-widest italic" style={{ fontSize: `${coordinates.docTitle.fontSize || 11}px` }}>{coordinates.docTitle.label || title}</h2>
                    </div>
                 )}

                 {coordinates.docId && (
                    <p className="absolute whitespace-nowrap z-[200] font-black uppercase tracking-widest" style={{ 
                        left: `${coordinates.docId.x}px`, top: `${coordinates.docId.y}px`,
                        fontSize: `${coordinates.docId.fontSize || 10}px`,
                        color: coordinates.docId.color || '#64748b'
                    }}>
                        {coordinates.docId.label || 'Doc #'} <span style={{ color: '#0f172a' }}>{documentNumber}</span>
                    </p>
                 )}

                 {coordinates.docDate && (
                    <p className="absolute whitespace-nowrap z-[200] font-black uppercase tracking-widest" style={{ 
                        left: `${coordinates.docDate.x}px`, top: `${coordinates.docDate.y}px`,
                        fontSize: `${coordinates.docDate.fontSize || 9}px`,
                        color: coordinates.docDate.color || '#64748b'
                    }}>
                        {coordinates.docDate.label || 'Date:'} <span style={{ color: '#0f172a' }}>{prescription?.created_at ? new Date(prescription.created_at).toLocaleDateString() : invoice?.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                    </p>
                 )}

                 {coordinates.token && (
                    <p className="absolute whitespace-nowrap z-[200] font-black uppercase tracking-widest" style={{ 
                        left: `${coordinates.token.x}px`, top: `${coordinates.token.y}px`,
                        fontSize: `${coordinates.token.fontSize || 10}px`,
                        color: coordinates.token.color || '#4f46e5'
                    }}>
                        {coordinates.token.label || 'Token #'} <span style={{ fontSize: '1.5em' }}>{(prescription as any)?.token_number || '---'}</span>
                    </p>
                 )}

                {showLogo && (company.logo_url ? (
                    <img
                        src={company.logo_url}
                        alt="Logo"
                        className="object-contain absolute z-[100]"
                        style={{ 
                            left: `${coordinates.logo?.x}px`, 
                            top: `${coordinates.logo?.y}px`,
                            height: `${coordinates.logo?.size || coordinates.logo?.width || logoSize}px`,
                            width: `${coordinates.logo?.size || coordinates.logo?.width || logoSize}px`
                        }}
                    />
                ) : (
                    <div 
                        className="bg-slate-900 rounded-2xl flex items-center justify-center text-white absolute z-[100]"
                        style={{ 
                            left: `${coordinates.logo?.x}px`, 
                            top: `${coordinates.logo?.y}px`,
                            height: `${coordinates.logo?.size || logoSize}px`,
                            width: `${coordinates.logo?.size || logoSize}px`,
                            borderRadius: '16px'
                        }}
                    >
                        <Building2 style={{ height: `${(coordinates.logo?.size || logoSize) * 0.5}px`, width: `${(coordinates.logo?.size || logoSize) * 0.5}px` }} />
                    </div>
                ))}

                <h1 
                    className="leading-none absolute whitespace-nowrap transition-colors z-[100]" 
                    style={{ 
                        left: `${coordinates.name?.x}px`, 
                        top: `${coordinates.name?.y}px`,
                        fontSize: `${coordinates.name?.fontSize || hospitalNameSize}px`,
                        fontWeight: coordinates.name?.fontWeight || '900',
                        color: coordinates.name?.color || hospitalNameColor,
                        fontFamily: (coordinates.name as any)?.fontType === 'times' || hospitalNameFont === 'times' ? 'Times New Roman, serif' : 'Inter, sans-serif',
                        letterSpacing: `${coordinates.name?.letterSpacing || hospitalNameLetterSpacing}px`,
                        padding: `${coordinates.name?.padding || 0}px`,
                        backgroundColor: coordinates.name?.backgroundColor || 'transparent',
                        borderRadius: `${coordinates.name?.borderRadius || 0}px`,
                        opacity: coordinates.name?.opacity !== undefined ? coordinates.name.opacity : 1
                    }}
                >
                    {coordinates.name?.label || company.name.toUpperCase()}
                </h1>

                {address && (
                    <p 
                        className="leading-tight absolute transition-colors z-[100]"
                        style={{ 
                            left: `${coordinates.address?.x}px`, 
                            top: `${coordinates.address?.y}px`,
                            fontSize: `${coordinates.address?.fontSize || addressSize}px`,
                            fontWeight: coordinates.address?.fontWeight || '600',
                            color: coordinates.address?.color || '#64748b',
                            width: coordinates.address?.width ? `${coordinates.address.width}px` : 'auto',
                            opacity: coordinates.address?.opacity !== undefined ? coordinates.address.opacity : 1
                        }}
                    >
                        {coordinates.address?.label || address}
                    </p>
                )}

                {showContactInfo && (
                    <div 
                        className="flex flex-col gap-1 absolute transition-colors z-[100]"
                        style={{ 
                            left: `${coordinates.contacts?.x}px`, 
                            top: `${coordinates.contacts?.y}px`,
                            color: coordinates.contacts?.color || '#000',
                            opacity: coordinates.contacts?.opacity !== undefined ? coordinates.contacts.opacity : 1
                        }}
                    >
                        {phone && (
                            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide font-bold">
                                <Phone className="h-2.5 w-2.5" style={{ color: hospitalPrimaryColor }} /> {phone}
                            </span>
                        )}
                        {email && (
                            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide font-bold">
                                <Mail className="h-2.5 w-2.5" style={{ color: hospitalPrimaryColor }} /> {email}
                            </span>
                        )}
                    </div>
                )}

                {/* ATOMIZED PATIENT FIELDS */}
                {coordinates.patientTitle && (
                    <p className="absolute whitespace-nowrap transition-colors z-[100]" style={{ 
                        left: `${coordinates.patientTitle.x}px`, top: `${coordinates.patientTitle.y}px`,
                        fontSize: `${coordinates.patientTitle.fontSize || 9}px`, fontWeight: coordinates.patientTitle.fontWeight || '900', color: coordinates.patientTitle.color || '#94a3b8',
                        opacity: coordinates.patientTitle.opacity !== undefined ? coordinates.patientTitle.opacity : 1
                    }}>{coordinates.patientTitle.label || 'Patient Details'}</p>
                )}

                {coordinates.patientName && (
                    <p className="absolute whitespace-nowrap transition-colors z-[100]" style={{ 
                        left: `${coordinates.patientName.x}px`, top: `${coordinates.patientName.y}px`,
                        fontSize: `${coordinates.patientName.fontSize || 20}px`, fontWeight: coordinates.patientName.fontWeight || '900', color: coordinates.patientName.color || '#0f172a',
                        letterSpacing: `${coordinates.patientName.letterSpacing || -1}px`,
                        opacity: coordinates.patientName.opacity !== undefined ? coordinates.patientName.opacity : 1
                    }}>{patient?.name || coordinates.patientName.label || 'Patient Name'}</p>
                )}

                {coordinates.patientId && (
                    <p className="absolute whitespace-nowrap transition-colors uppercase tracking-wider z-[100]" style={{ 
                        left: `${coordinates.patientId.x}px`, top: `${coordinates.patientId.y}px`,
                        fontSize: `${coordinates.patientId.fontSize || 10}px`, fontWeight: coordinates.patientId.fontWeight || '700', color: coordinates.patientId.color || '#64748b',
                        opacity: coordinates.patientId.opacity !== undefined ? coordinates.patientId.opacity : 1
                    }}>{patient?.id ? `ID: ${patient.id}` : coordinates.patientId.label || 'ID: 001'}</p>
                )}

                {(coordinates.patientAgeGender || coordinates.patientDemographics) && (
                    <p className="absolute whitespace-nowrap transition-colors uppercase tracking-wider z-[100]" style={{ 
                        left: `${(coordinates.patientAgeGender || coordinates.patientDemographics)!.x}px`, top: `${(coordinates.patientAgeGender || coordinates.patientDemographics)!.y}px`,
                        fontSize: `${(coordinates.patientAgeGender || coordinates.patientDemographics)!.fontSize || 10}px`, fontWeight: (coordinates.patientAgeGender || coordinates.patientDemographics)!.fontWeight || '700', color: (coordinates.patientAgeGender || coordinates.patientDemographics)!.color || '#64748b',
                        opacity: (coordinates.patientAgeGender || coordinates.patientDemographics)!.opacity !== undefined ? (coordinates.patientAgeGender || coordinates.patientDemographics)!.opacity : 1
                    }}>{patient?.ageGender || (coordinates.patientAgeGender || coordinates.patientDemographics)!.label || 'Age: 42Y'}</p>
                )}

                {/* CLINICAL FIELDS (OP SLIP) */}
                {coordinates.doctor && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.doctor.x}px`, top: `${coordinates.doctor.y}px` }}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{coordinates.doctor.label || 'Consulting Doctor'}</p>
                         <p className="text-sm font-black text-slate-900" style={{ fontSize: `${coordinates.doctor.fontSize || 14}px` }}>
                            {prescription?.hms_doctor?.name || '---'}
                         </p>
                    </div>
                )}

                {coordinates.department && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.department.x}px`, top: `${coordinates.department.y}px` }}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Department</p>
                         <p className="text-xs font-black" style={{ fontSize: `${coordinates.department.fontSize || 10}px`, color: coordinates.department.color || hospitalPrimaryColor }}>
                            {prescription?.hms_doctor?.department || 'General Medicine'}
                         </p>
                    </div>
                )}

                {/* VITALS GRID */}
                {coordinates.vitalBP && (
                    <div className="absolute z-[100] border-l border-slate-200 pl-3" style={{ left: `${coordinates.vitalBP.x}px`, top: `${coordinates.vitalBP.y}px` }}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{coordinates.vitalBP.label || 'BP'}</p>
                        <p className="text-xs font-black text-slate-900">{(prescription?.vitals as any)?.bp || '---'}</p>
                    </div>
                )}
                {coordinates.vitalPulse && (
                    <div className="absolute z-[100] border-l border-slate-200 pl-3" style={{ left: `${coordinates.vitalPulse.x}px`, top: `${coordinates.vitalPulse.y}px` }}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{coordinates.vitalPulse.label || 'Pulse'}</p>
                        <p className="text-xs font-black text-slate-900">{(prescription?.vitals as any)?.pulse || '---'}</p>
                    </div>
                )}
                {coordinates.vitalTemp && (
                    <div className="absolute z-[100] border-l border-slate-200 pl-3" style={{ left: `${coordinates.vitalTemp.x}px`, top: `${coordinates.vitalTemp.y}px` }}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{coordinates.vitalTemp.label || 'Temp'}</p>
                        <p className="text-xs font-black text-slate-900">{(prescription?.vitals as any)?.temp || '---'}</p>
                    </div>
                )}
                {coordinates.vitalWeight && (
                    <div className="absolute z-[100] border-l border-slate-200 pl-3" style={{ left: `${coordinates.vitalWeight.x}px`, top: `${coordinates.vitalWeight.y}px` }}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{coordinates.vitalWeight.label || 'Weight'}</p>
                        <p className="text-xs font-black text-slate-900">{(prescription?.vitals as any)?.weight || '---'}</p>
                    </div>
                )}
                {coordinates.vitalSpo2 && (
                    <div className="absolute z-[100] border-l border-slate-200 pl-3" style={{ left: `${coordinates.vitalSpo2.x}px`, top: `${coordinates.vitalSpo2.y}px` }}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{coordinates.vitalSpo2.label || 'SpO2'}</p>
                        <p className="text-xs font-black text-slate-900">{(prescription?.vitals as any)?.spo2 || '---'}</p>
                    </div>
                )}

                {coordinates.rxSymbol && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.rxSymbol.x}px`, top: `${coordinates.rxSymbol.y}px` }}>
                        <p className="font-black text-slate-900 leading-none" style={{ fontSize: `${coordinates.rxSymbol.fontSize || 40}px` }}>{coordinates.rxSymbol.label || '℞'}</p>
                    </div>
                )}

                {coordinates.notes && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.notes.x}px`, top: `${coordinates.notes.y}px` }}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{coordinates.notes.label || 'Clinical Notes'}</p>
                        <div className="border border-dashed border-slate-200 rounded-xl p-4 min-w-[500px]">
                            <p className="text-xs text-slate-400 italic">No notes recorded for this visit.</p>
                        </div>
                    </div>
                )}

                {/* ATOMIZED TOTALS */}
                {coordinates.subtotal && (
                    <div className="absolute min-w-[200px] flex justify-between items-center z-[100]" style={{ left: `${coordinates.subtotal.x}px`, top: `${coordinates.subtotal.y}px`, color: coordinates.subtotal.color || '#64748b' }}>
                        <span className="font-bold uppercase tracking-widest" style={{ fontSize: `${(coordinates.subtotal.fontSize || 10) - 2}px` }}>{coordinates.subtotal.label || 'Subtotal:'}</span>
                        <span className="font-black" style={{ fontSize: `${coordinates.subtotal.fontSize || 10}px` }}>₹{Number(invoice?.subtotal || 1450).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}

                {coordinates.tax && (
                    <div className="absolute min-w-[200px] flex justify-between items-center z-[100]" style={{ left: `${coordinates.tax.x}px`, top: `${coordinates.tax.y}px`, color: coordinates.tax.color || '#64748b' }}>
                        <span className="font-bold uppercase tracking-widest" style={{ fontSize: `${(coordinates.tax.fontSize || 10) - 2}px` }}>{coordinates.tax.label || 'Tax:'}</span>
                        <span className="font-black" style={{ fontSize: `${coordinates.tax.fontSize || 10}px` }}>₹{Number(invoice?.total_tax || 72).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}

                {coordinates.total && (
                    <div className="absolute min-w-[240px] flex justify-between items-center z-[100]" style={{ 
                        left: `${coordinates.total.x}px`, top: `${coordinates.total.y}px`, 
                        backgroundColor: coordinates.total.backgroundColor || hospitalPrimaryColor, 
                        color: coordinates.total.color || '#ffffff',
                        padding: `${coordinates.total.padding || 12}px`,
                        borderRadius: `${coordinates.total.borderRadius || 4}px`
                    }}>
                        <span className="font-black uppercase tracking-widest" style={{ fontSize: `${(coordinates.total.fontSize || 14) - 4}px` }}>{coordinates.total.label || 'Payable'}</span>
                        <span className="font-black" style={{ fontSize: `${coordinates.total.fontSize || 14}px` }}>₹{Number(invoice?.total || 1522).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}

                {/* BANK DETAILS BLOCK */}
                {coordinates.bank?.showSection !== false && (coordinates.bank?.opacity !== 0) && (
                    <div 
                        className="absolute flex flex-col gap-1 p-3 transition-colors z-[100]"
                        style={{ 
                            left: `${coordinates.bank?.x}px`, 
                            top: `${coordinates.bank?.y}px`,
                            backgroundColor: coordinates.bank?.backgroundColor || 'transparent',
                            padding: `${coordinates.bank?.padding || 0}px`,
                            borderRadius: `${coordinates.bank?.borderRadius || 0}px`,
                            opacity: coordinates.bank?.opacity !== undefined ? coordinates.bank.opacity : 1,
                            width: '250px'
                        }}
                    >
                         <p className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none"><Landmark className="h-2.5 w-2.5" /> BANK INFORMATION</p>
                         <p className="text-[10px] font-bold leading-tight italic whitespace-pre-wrap" style={{ fontSize: `${coordinates.bank?.fontSize || 9}px`, fontWeight: coordinates.bank?.fontWeight || '700', color: coordinates.bank?.color || '#1e293b' }}>{coordinates.bank?.label || 'Account Details Missing'}</p>
                    </div>
                )}

                {/* QR CODE BLOCK */}
                {coordinates.qr?.showSection !== false && (coordinates.qr?.opacity !== 0) && (
                    <div 
                        className="absolute flex flex-col items-center gap-2 p-3 transition-colors z-[100]"
                        style={{ 
                            left: `${coordinates.qr?.x}px`, 
                            top: `${coordinates.qr?.y}px`,
                            backgroundColor: coordinates.qr?.backgroundColor || 'transparent',
                            padding: `${coordinates.qr?.padding || 0}px`,
                            borderRadius: `${coordinates.qr?.borderRadius || 0}px`,
                            opacity: coordinates.qr?.opacity !== undefined ? coordinates.qr.opacity : 1
                        }}
                    >
                        <div className="h-16 w-16 bg-white p-1 rounded-lg border border-slate-100 flex items-center justify-center shadow-md"><QrCode className="h-12 w-12 text-slate-900" /></div>
                    </div>
                )}

                {/* PREPARED BY & DISCLAIMER */}
                {coordinates.preparedBy && (coordinates.preparedBy.opacity !== 0) && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.preparedBy.x}px`, top: `${coordinates.preparedBy.y}px`, opacity: coordinates.preparedBy.opacity ?? 1 }}>
                         <p className="text-[10px] font-bold text-slate-800" style={{ fontSize: `${coordinates.preparedBy.fontSize || 10}px`, color: coordinates.preparedBy.color || '#000' }}>
                           {coordinates.preparedBy.label || 'Prepared By: Admin'}
                         </p>
                    </div>
                )}

                {coordinates.disclaimer && (coordinates.disclaimer.opacity !== 0) && (
                    <div className="absolute z-[100]" style={{ left: `${coordinates.disclaimer.x}px`, top: `${coordinates.disclaimer.y}px`, width: `${coordinates.disclaimer.width || 700}px`, opacity: coordinates.disclaimer.opacity ?? 1 }}>
                         <p className="italic leading-tight transition-colors" style={{ fontSize: `${coordinates.disclaimer.fontSize || 8}px`, fontWeight: coordinates.disclaimer.fontWeight || '500', color: coordinates.disclaimer.color || '#94a3b8' }}>
                           {coordinates.disclaimer.label || 'Computer generated document.'}
                         </p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="border-b border-slate-300 pb-8 mb-10 overflow-visible">
            <div className={`flex ${isCenter ? 'flex-col items-center gap-6' : 'justify-between items-start'} relative`}>
                
                {/* Branding Left/Center Block */}
                <div className={`flex gap-10 items-center 
                    ${isStack ? 'flex-col text-center' : isLogoRight ? 'flex-row-reverse text-right' : 'flex-row text-left'} 
                    ${isLogoCenter ? 'items-center text-center' : ''}`}
                >
                    
                    {/* Logo */}
                    {showLogo && (company.logo_url ? (
                        <img
                            src={company.logo_url}
                            alt={company.name}
                            className="object-contain rounded-2xl shadow-sm border border-slate-100 p-2 bg-white"
                            style={{ 
                                height: isStack ? `${logoSize * 1.5}px` : `${logoSize}px`,
                                width: isStack ? `${logoSize * 1.5}px` : `${logoSize}px`
                            }}
                        />
                    ) : (
                        <div 
                            className="bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"
                            style={{ 
                                height: isStack ? `${logoSize * 1.2}px` : `${logoSize}px`,
                                width: isStack ? `${logoSize * 1.2}px` : `${logoSize}px`
                            }}
                        >
                            <Building2 style={{ height: `${logoSize * 0.5}px`, width: `${logoSize * 0.5}px` }} />
                        </div>
                    ))}

                    <div className={`space-y-1.5 min-w-[300px] ${isStack ? 'flex flex-col items-center' : ''}`}>
                        <h1 
                            className="font-black tracking-tighter leading-tight" 
                            style={{ 
                                fontSize: `${hospitalNameSize}px`,
                                color: hospitalNameColor,
                                fontFamily: hospitalNameFont === 'times' ? 'Times New Roman, serif' : 'Inter, sans-serif',
                                letterSpacing: `${hospitalNameLetterSpacing}px`
                            }}
                        >
                            {company.name.toUpperCase()}
                        </h1>
                        
                        {address && (
                            <p 
                                className={`text-slate-500 font-bold max-w-lg leading-relaxed ${isStack ? 'text-center' : ''}`}
                                style={{ fontSize: `${addressSize}px` }}
                            >
                                {address}
                            </p>
                        )}

                        {showContactInfo && (
                            <div className={`flex flex-wrap gap-x-6 gap-y-1.5 mt-4 text-slate-600 font-bold ${isStack || isCenter || isLogoCenter ? 'justify-center' : isLogoRight ? 'justify-end' : 'justify-start'}`}>
                                {phone && (
                                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                                        <Phone className="h-3 w-3" style={{ color: hospitalPrimaryColor }} /> {phone}
                                    </span>
                                )}
                                {email && (
                                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                                        <Mail className="h-3 w-3" style={{ color: hospitalPrimaryColor }} /> {email}
                                    </span>
                                )}
                                {website && (
                                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                                        <Globe className="h-3 w-3" style={{ color: hospitalPrimaryColor }} /> {website}
                                    </span>
                                )}
                            </div>
                        )}

                        {gstin && (
                            <div className={`mt-3 py-1 px-3 bg-slate-50 border border-slate-100 rounded-lg inline-block ${isStack || isCenter || isLogoCenter ? 'mx-auto' : ''}`}>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    GSTIN / REG: <span className="text-slate-900 ml-1">{gstin}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Document Info Block (Always separate or on bottom if center) */}
                <div className={`flex flex-col ${isCenter ? 'items-center mt-8' : 'items-end'}`}>
                    <div className="text-white px-6 py-2 rounded-xl mb-3 shadow-lg" style={{ backgroundColor: hospitalPrimaryColor }}>
                        <h2 className="text-sm font-black tracking-widest uppercase italic">{title}</h2>
                    </div>
                    <div className="flex flex-col items-end">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Doc Number</p>
                        <p className="text-xl font-black text-slate-900 tracking-tighter"># <span className="font-mono" style={{ color: hospitalPrimaryColor }}>{documentNumber}</span></p>
                    </div>
                    {subtitle && <p className="text-[9px] font-black uppercase tracking-widest mt-2 px-2 py-0.5 rounded shadow-sm" style={{ color: hospitalPrimaryColor, backgroundColor: `${hospitalPrimaryColor}15` }}>{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}
