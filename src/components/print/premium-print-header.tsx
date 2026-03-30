import { Building2, Mail, Phone, Globe, MapPin } from "lucide-react";

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
}

export function PremiumPrintHeader({ company, title, subtitle, documentNumber, hide = false }: PremiumPrintHeaderProps) {
    if (hide) return null;
    
    const metadata = company.metadata || {};
    const address = metadata.address || '';
    const email = metadata.email || '';
    const phone = metadata.phone || '';
    const website = metadata.website || '';
    const gstin = metadata.gstin || '';

    return (
        <div className="border-b border-slate-300 pb-8 mb-10">
            <div className="flex justify-between items-start">
                <div className="flex gap-6 items-center">
                    {company.logo_url ? (
                        <img
                            src={company.logo_url}
                            alt={company.name}
                            className="h-20 w-20 object-contain rounded-xl shadow-sm border border-slate-100 p-2"
                        />
                    ) : (
                        <div className="h-20 w-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                            <Building2 className="h-10 w-10" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none mb-2">{company.name.toUpperCase()}</h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500 font-medium">
                            {address && (
                                <span className="flex items-center gap-1.5 text-xs">
                                    <MapPin className="h-3 w-3 text-slate-400" /> {address}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-slate-500 font-medium">
                            {phone && (
                                <span className="flex items-center gap-1.5 text-xs">
                                    <Phone className="h-3 w-3 text-slate-400" /> {phone}
                                </span>
                            )}
                            {email && (
                                <span className="flex items-center gap-1.5 text-xs">
                                    <Mail className="h-3 w-3 text-slate-400" /> {email}
                                </span>
                            )}
                            {website && (
                                <span className="flex items-center gap-1.5 text-xs">
                                    <Globe className="h-3 w-3 text-slate-400" /> {website}
                                </span>
                            )}
                        </div>
                        {gstin && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                                GSTIN: <span className="text-slate-900">{gstin}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="text-right flex flex-col items-end">
                    <div className="border border-slate-300 text-slate-800 px-4 py-1.5 rounded-lg mb-2">
                        <h2 className="text-sm font-bold tracking-widest uppercase">{title}</h2>
                    </div>
                    <p className="text-sm font-bold text-slate-800 uppercase">NO: <span className="font-mono text-indigo-600">{documentNumber}</span></p>
                    {subtitle && <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}
