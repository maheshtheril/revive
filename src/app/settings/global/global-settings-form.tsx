'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateGlobalSettings, updateTenantSettings, updateWhatsAppSettings, updatePDFSettings, updateAISettings } from '@/app/actions/settings'
import { Loader2, Save, Building2, Coins, ShieldCheck, Database, Layout, MessageSquare, FileText, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Zap, Sparkles } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { FileUpload } from '@/components/ui/file-upload'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'

interface Props {
    company: any
    tenant: any
    currencies: any[]
    isTenantAdmin: boolean
    isAdmin: boolean
    whatsappSettings?: any
    pdfSettings?: any
    aiSettings?: any
}

export function GlobalSettingsForm({ company, tenant, currencies, isTenantAdmin, isAdmin, whatsappSettings, pdfSettings, aiSettings }: Props) {
    const { update } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState(company.name)
    const [industry, setIndustry] = useState(company.industry || '')
    const [logoUrl, setLogoUrl] = useState(company.logo_url || '')
    const [currencyId, setCurrencyId] = useState(company.company_settings?.currency_id || '')
    const [invoicePrefix, setInvoicePrefix] = useState(company.company_settings?.numbering_prefix || 'INV')
    const [timezone, setTimezone] = useState(company.company_settings?.timezone || 'Asia/Kolkata')
    const [locale, setLocale] = useState(company.company_settings?.locale || 'en-US')

    // Contact Info & Metadata (stored in metadata)
    const meta = (company.metadata as any) || {}
    const [patientIdPrefix, setPatientIdPrefix] = useState(meta.patient_id_prefix || 'PAT')
    const [patientIdMode, setPatientIdMode] = useState(meta.patient_id_mode || 'timestamp')
    const [patientIdStartNumber, setPatientIdStartNumber] = useState(meta.patient_id_start_number || '1000')
    const [invoiceStartNumber, setInvoiceStartNumber] = useState(meta.invoice_start_number || '1')

    // Tenant Branding
    const [appName, setAppName] = useState(tenant?.app_name || tenant?.name || '')
    const [tenantLogoUrl, setTenantLogoUrl] = useState(tenant?.logo_url || '')
    const [dbUrl, setDbUrl] = useState(tenant?.db_url || '')
    const [registrationEnabled, setRegistrationEnabled] = useState((tenant?.metadata as any)?.registration_enabled !== false)
    const [dateFormat, setDateFormat] = useState((tenant?.metadata as any)?.date_format || 'PPP')
    const [roundingPrecision, setRoundingPrecision] = useState(company.company_settings?.rounding_precision ?? 2)
    const [appUrl, setAppUrl] = useState(tenant?.app_url || '')
    const [localOrigin, setLocalOrigin] = useState('')
    const [isMounted, setIsMounted] = useState(false)

    const [address, setAddress] = useState(meta.address || '')
    const [phone, setPhone] = useState(meta.phone || '')
    const [email, setEmail] = useState(meta.email || '')
    const [gstin, setGstin] = useState(meta.gstin || '')

    // WhatsApp Settings Mirror
    const [whatsappEnabled, setWhatsappEnabled] = useState(whatsappSettings?.enabled ?? false)
    const [whatsappInstanceId, setWhatsappInstanceId] = useState(whatsappSettings?.instanceId ?? '')
    const [whatsappToken, setWhatsappToken] = useState('')
    const [whatsappAutoSendBill, setWhatsappAutoSendBill] = useState(whatsappSettings?.autoSendBill ?? false)
    const [showWhatsappToken, setShowWhatsappToken] = useState(false)
    const [hasExistingWhatsappToken, setHasExistingWhatsappToken] = useState(whatsappSettings?.hasToken ?? false)

    // PDF Print Settings Mirror
    const [pdfHeaderAlignment, setPdfHeaderAlignment] = useState<'left' | 'center' | 'right'>(pdfSettings?.headerAlignment || 'right')
    const [pdfShowLogo, setPdfShowLogo] = useState(pdfSettings?.showLogo ?? true)
    const [pdfHospitalNameSize, setPdfHospitalNameSize] = useState(pdfSettings?.hospitalNameSize || 16)
    const [pdfAddressSize, setPdfAddressSize] = useState(pdfSettings?.addressSize || 10)
    const [pdfLogoSize, setPdfLogoSize] = useState(pdfSettings?.logoSize || 80)
    const [pdfHospitalNameColor, setPdfHospitalNameColor] = useState(pdfSettings?.hospitalNameColor || '#000000')
    const [pdfHospitalNameFont, setPdfHospitalNameFont] = useState<'times' | 'helvetica'>(pdfSettings?.hospitalNameFont || 'times')
    const [pdfHospitalPrimaryColor, setPdfHospitalPrimaryColor] = useState(pdfSettings?.hospitalPrimaryColor || '#4f46e5')
    const [pdfHospitalNameLetterSpacing, setPdfHospitalNameLetterSpacing] = useState(pdfSettings?.hospitalNameLetterSpacing || 0)
    const [pdfShowContactInfo, setPdfShowContactInfo] = useState(pdfSettings?.showContactInfo ?? true)
    const [pdfAutoPrint, setPdfAutoPrint] = useState(pdfSettings?.autoPrint ?? false)
    const [pdfShowTaxOnBill, setPdfShowTaxOnBill] = useState(pdfSettings?.showTaxOnBill ?? true)
    
    // AI Settings
    const [aiEnabled, setAiEnabled] = useState(aiSettings?.enabled ?? true)
    const [aiApiKey, setAiApiKey] = useState('')
    const [showAiApiKey, setShowAiApiKey] = useState(false)
    const [hasExistingAiKey, setHasExistingAiKey] = useState(aiSettings?.hasKey ?? false)

    // Sync state with props when they change from server
    useEffect(() => {
        setName(company.name)
        setIndustry(company.industry || '')
        setLogoUrl(company.logo_url || '')
        setCurrencyId(company.company_settings?.currency_id || '')
        setInvoicePrefix(company.company_settings?.numbering_prefix || 'INV')
        setAppName(tenant?.app_name || tenant?.name || '')
        setTenantLogoUrl(tenant?.logo_url || '')
        setDbUrl(tenant?.db_url || '')
        setDateFormat((tenant?.metadata as any)?.date_format || 'PPP')
        setRoundingPrecision(company.company_settings?.rounding_precision ?? 2)

        const m = (company.metadata as any) || {}
        setAddress(m.address || '')
        setPhone(m.phone || '')
        setEmail(m.email || '')
        setGstin(m.gstin || '')
        setPatientIdPrefix(m.patient_id_prefix || 'PAT')
        setPatientIdMode(m.patient_id_mode || 'timestamp')
        setPatientIdStartNumber(m.patient_id_start_number || '1000')
        setInvoiceStartNumber(m.invoice_start_number || '1')
        setAppUrl(tenant?.app_url || '')
        setTimezone(company.company_settings?.timezone || 'Asia/Kolkata')
        setLocale(company.company_settings?.locale || 'en-US')
    }, [company, tenant])

    // Mirror sync for WhatsApp and PDF
    useEffect(() => {
        if (whatsappSettings) {
            setWhatsappEnabled(whatsappSettings.enabled ?? false);
            setWhatsappInstanceId(whatsappSettings.instanceId ?? '');
            setWhatsappAutoSendBill(whatsappSettings.autoSendBill ?? false);
            // Ensure we update the existence flag from the server source of truth
            setHasExistingWhatsappToken(whatsappSettings.hasToken ?? false);
        }
    }, [whatsappSettings, whatsappSettings?.hasToken]);

    useEffect(() => {
        if (pdfSettings) {
            setPdfHeaderAlignment(pdfSettings.headerAlignment || 'right');
            setPdfShowLogo(pdfSettings.showLogo ?? true);
            setPdfHospitalNameSize(pdfSettings.hospitalNameSize || 16);
            setPdfAddressSize(pdfSettings.addressSize || 10);
            setPdfLogoSize(pdfSettings.logoSize || 80);
            setPdfHospitalNameColor(pdfSettings.hospitalNameColor || '#000000');
            setPdfHospitalNameFont(pdfSettings.hospitalNameFont || 'times');
            setPdfHospitalPrimaryColor(pdfSettings.hospitalPrimaryColor || '#4f46e5');
            setPdfHospitalNameLetterSpacing(pdfSettings.hospitalNameLetterSpacing || 0);
            setPdfShowContactInfo(pdfSettings.showContactInfo ?? true);
            setPdfAutoPrint(pdfSettings.autoPrint ?? false);
            setPdfShowTaxOnBill(pdfSettings.showTaxOnBill ?? true);
        }
    }, [pdfSettings]);

    useEffect(() => {
        if (aiSettings) {
            setAiEnabled(aiSettings.enabled ?? true);
            setHasExistingAiKey(aiSettings.hasKey ?? false);
        }
    }, [aiSettings]);

    // FIX: Hydration error - set browser-specific values after mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setLocalOrigin(window.location.origin);
            setIsMounted(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const [result, whatsappRes, pdfRes, aiRes] = await Promise.all([
                updateGlobalSettings({
                    companyId: company.id,
                    name,
                    industry,
                    logoUrl,
                    currencyId,
                    address,
                    phone,
                    email,
                    gstin,
                    invoicePrefix,
                    roundingPrecision: Number(roundingPrecision),
                    timezone,
                    locale,
                    patientIdPrefix,
                    patientIdMode,
                    patientIdStartNumber: Number(patientIdStartNumber),
                    invoiceStartNumber: Number(invoiceStartNumber)
                }),
                updateWhatsAppSettings({
                    enabled: whatsappEnabled,
                    instanceId: whatsappInstanceId,
                    provider: 'ultramsg',
                    token: whatsappToken || undefined,
                    autoSendBill: whatsappAutoSendBill,
                    companyId: company.id
                }),
                updatePDFSettings({
                    headerAlignment: pdfHeaderAlignment as any,
                    showLogo: pdfShowLogo,
                    hospitalNameSize: Number(pdfHospitalNameSize),
                    addressSize: Number(pdfAddressSize),
                    logoSize: Number(pdfLogoSize),
                    hospitalNameColor: pdfHospitalNameColor,
                    hospitalNameFont: pdfHospitalNameFont,
                    hospitalPrimaryColor: pdfHospitalPrimaryColor,
                    hospitalNameLetterSpacing: Number(pdfHospitalNameLetterSpacing),
                    showContactInfo: pdfShowContactInfo,
                    autoPrint: pdfAutoPrint,
                    showTaxOnBill: pdfShowTaxOnBill,
                    showTaxInvoiceTitle: pdfShowTaxOnBill
                }),
                updateAISettings({
                    enabled: aiEnabled,
                    apiKey: aiApiKey || undefined
                })
            ])

            let tenantResult = { success: true, error: null as string | null };
            if (isTenantAdmin || isAdmin) {
                const res = await updateTenantSettings({
                    tenantId: tenant.id,
                    appName,
                    logoUrl: tenantLogoUrl,
                    dbUrl: dbUrl || undefined,
                    registrationEnabled,
                    dateFormat,
                    appUrl: appUrl || undefined
                });
                if (!res.success) {
                    tenantResult = { success: false, error: res.error || 'Failed to update tenant branding' };
                }
            }

            if (result.success && tenantResult.success && whatsappRes.success && pdfRes.success && aiRes.success) {
                if (isTenantAdmin || isAdmin) {
                    await update({ dbUrl: dbUrl || null });
                }
                toast({ title: "Settings Updated", description: "Global, WhatsApp, PDF, and AI settings saved successfully." });
                if (whatsappToken) { setWhatsappToken(''); setHasExistingWhatsappToken(true); }
                if (aiApiKey) { setAiApiKey(''); setHasExistingAiKey(true); }
                router.refresh()
            } else {
                const errorMsg = result.error || tenantResult.error || whatsappRes.error || pdfRes.error || aiRes.error;
                toast({ title: "Error", description: errorMsg || "Something went wrong", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Critical Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false)
        }
    }

    const handleTestAi = async () => {
        setLoading(true);
        toast({ title: "Testing AI...", description: "Connecting to Google Gemini..." });

        try {
            const res = await fetch('/api/ai-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testKey: aiApiKey })
            });

            const result = await res.json();
            
            if (result.success) {
                toast({ 
                    title: "AI Connection OK! ✓", 
                    description: "Your key is working perfectly. Don't forget to SAVE all settings.",
                    variant: "default",
                    className: "bg-emerald-600 text-white"
                });
                setHasExistingAiKey(true);
            } else {
                const isNotEnabled = (result.error || "").toLowerCase().includes("not enabled") || (result.error || "").includes("404");
                toast({ 
                    title: isNotEnabled ? "⚠️ FIX REQUIRED: Enable API" : "AI Test FAILED ✗", 
                    description: isNotEnabled 
                        ? "Google says 'API Not Enabled'. Please use a key from https://aistudio.google.com/app/apikey - it works instantly!"
                        : result.error || "Connection error. Please check your key.", 
                    variant: "destructive",
                    duration: 10000 // Show longer to allow reading
                });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-24 animate-in fade-in duration-500">

            {/* 1. Basic Company Details */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-100 italic font-black">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                        ORGANIZATION PROFILE
                    </CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-70">Core identity and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Logo</Label>
                            <FileUpload
                                folder="logos"
                                accept="image/*"
                                currentFileUrl={logoUrl}
                                onUploadComplete={(url) => setLogoUrl(url)}
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hospital / Company Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. City General Hospital" className="font-bold border-2 focus:border-indigo-500 transition-all rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</Label>
                                <div className="min-h-[40px]">
                                    {isMounted ? (
                                        <Select value={industry} onValueChange={setIndustry}>
                                            <SelectTrigger className="font-bold border-2 rounded-xl">
                                                <SelectValue placeholder="Select industry" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Healthcare">Healthcare (Hospital/Clinic)</SelectItem>
                                                <SelectItem value="Technology">Technology</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="h-10 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Official Address</Label>
                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address for invoicing and prescriptions" className="font-bold border-2 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Official Phone</Label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 ..." className="font-bold border-2 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Official Email</Label>
                            <Input 
                                type="email"
                                value={email} 
                                onChange={e => setEmail(e.target.value.toLowerCase())} 
                                placeholder="billing@company.com" 
                                autoCapitalize="none"
                                className="font-bold border-2 rounded-xl lowercase" 
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. PDF Print Layout (MIRRORED) */}
            <Card className="border-indigo-200 dark:border-indigo-900/50 shadow-md bg-white dark:bg-slate-900 border-t-4 border-t-indigo-500">
                <CardHeader className="bg-indigo-50/30 dark:bg-indigo-950/20">
                    <CardTitle className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 italic font-black">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        PDF DOCUMENT BRANDING
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-indigo-600/70 uppercase tracking-widest">Configure Invoices and Prescriptions layout</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                        <Label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Header Content Alignment</Label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'left', icon: AlignLeft, label: 'Left' },
                                { id: 'center', icon: AlignCenter, label: 'Center' },
                                { id: 'right', icon: AlignRight, label: 'Right' }
                            ].map((pos) => (
                                <button
                                    key={pos.id}
                                    type="button"
                                    onClick={() => setPdfHeaderAlignment(pos.id as any)}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${pdfHeaderAlignment === pos.id
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                        : 'border-transparent bg-white dark:bg-slate-900 text-slate-400 hover:border-slate-200 dark:hover:border-slate-700'
                                        }`}
                                >
                                    <pos.icon className="h-5 w-5" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">{pos.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-white transition-colors">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Show Logo on PDFs</span>
                                <Switch checked={pdfShowLogo} onCheckedChange={setPdfShowLogo} />
                            </label>
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-white transition-colors">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Show Contact info</span>
                                <Switch checked={pdfShowContactInfo} onCheckedChange={setPdfShowContactInfo} />
                            </label>
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-white transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Auto-print Bill after save</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-tight italic">Automatically open print window</span>
                                </div>
                                <Switch checked={pdfAutoPrint} onCheckedChange={setPdfAutoPrint} />
                            </label>
                            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-white transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Show Tax Breakdown on Invoices</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-tight italic">Display tax invoice title & itemized GST</span>
                                </div>
                                <Switch checked={pdfShowTaxOnBill} onCheckedChange={setPdfShowTaxOnBill} />
                            </label>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Title Size</span>
                                    <span className="text-[10px] font-black text-indigo-600">{pdfHospitalNameSize}px</span>
                                </div>
                                <input type="range" min="12" max="32" value={pdfHospitalNameSize} onChange={(e) => setPdfHospitalNameSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Address Size</span>
                                    <span className="text-[10px] font-black text-indigo-600">{pdfAddressSize}px</span>
                                </div>
                                <input type="range" min="8" max="16" value={pdfAddressSize} onChange={(e) => setPdfAddressSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Logo Width</span>
                                    <span className="text-[10px] font-black text-indigo-600">{pdfLogoSize}px</span>
                                </div>
                                <input type="range" min="40" max="200" value={pdfLogoSize} onChange={(e) => setPdfLogoSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hospital Name Font</span>
                                    <span className="text-[10px] font-black text-indigo-600">{pdfHospitalNameFont === 'times' ? 'Serif' : 'Modern'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        type="button" 
                                        variant={pdfHospitalNameFont === 'times' ? 'default' : 'outline'} 
                                        onClick={() => setPdfHospitalNameFont('times')}
                                        className="flex-1 h-8 text-[10px] font-bold uppercase tracking-tighter"
                                    >
                                        Classic Serif
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant={pdfHospitalNameFont === 'helvetica' ? 'default' : 'outline'} 
                                        onClick={() => setPdfHospitalNameFont('helvetica')}
                                        className="flex-1 h-8 text-[10px] font-bold uppercase tracking-tighter"
                                    >
                                        Modern Sans
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-3">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Brand Colors</span>
                                    <div className="flex gap-2">
                                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: pdfHospitalNameColor }} />
                                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: pdfHospitalPrimaryColor }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[8px] text-slate-400">Name Color</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={pdfHospitalNameColor} onChange={e => setPdfHospitalNameColor(e.target.value)} className="w-8 h-8 rounded-lg overflow-hidden border-0 p-0" />
                                            <input type="text" value={pdfHospitalNameColor} onChange={e => setPdfHospitalNameColor(e.target.value)} className="flex-1 h-8 text-[10px] font-mono px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[8px] text-slate-400">Accent Color</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={pdfHospitalPrimaryColor} onChange={e => setPdfHospitalPrimaryColor(e.target.value)} className="w-8 h-8 rounded-lg overflow-hidden border-0 p-0" />
                                            <input type="text" value={pdfHospitalPrimaryColor} onChange={e => setPdfHospitalPrimaryColor(e.target.value)} className="flex-1 h-8 text-[10px] font-mono px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Letter Spacing</span>
                                    <span className="text-[10px] font-black text-indigo-600">{pdfHospitalNameLetterSpacing}px</span>
                                </div>
                                <input type="range" min="-2" max="10" step="0.5" value={pdfHospitalNameLetterSpacing} onChange={(e) => setPdfHospitalNameLetterSpacing(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                                <p className="text-[8px] text-slate-400 mt-1 italic text-center">Wider spacing creates a more premium, modern feel</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. WhatsApp Integration (MIRRORED) */}
            <Card className="border-emerald-200 dark:border-emerald-900/50 shadow-md bg-white dark:bg-slate-900 border-t-4 border-t-emerald-500">
                <CardHeader className="bg-emerald-50/30 dark:bg-emerald-950/20">
                    <CardTitle className="flex items-center gap-3 text-emerald-900 dark:text-emerald-100 italic font-black">
                        <MessageSquare className="h-5 w-5 text-emerald-600" />
                        WHATSAPP CLOUD SETTINGS
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">Connect UltraMsg for automated notifications</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-emerald-500" />
                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 italic">WhatsApp Gateway Status</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Enable automated outgoing messages</p>
                            </div>
                        </div>
                        <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!whatsappEnabled ? 'opacity-40' : ''}`}>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instance ID</Label>
                            <Input value={whatsappInstanceId} onChange={e => setWhatsappInstanceId(e.target.value)} placeholder="e.g. instance12345" className="font-mono text-sm rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Token {hasExistingWhatsappToken && !whatsappToken && "✓"}</Label>
                            <div className="relative">
                                <Input 
                                    type={showWhatsappToken ? 'text' : 'password'} 
                                    value={whatsappToken} 
                                    onChange={e => setWhatsappToken(e.target.value)} 
                                    placeholder={
                                        whatsappToken 
                                            ? 'Entering new token...' 
                                            : hasExistingWhatsappToken 
                                                ? (showWhatsappToken ? '[TOKEN SAVED & HIDDEN]' : '✓ SAVED & PROTECTED')
                                                : 'Enter UltraMsg API Token'
                                    } 
                                    className={`font-mono text-sm rounded-xl pr-10 ${hasExistingWhatsappToken && !whatsappToken ? 'bg-emerald-50/10' : ''}`} 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowWhatsappToken(!showWhatsappToken)} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    title={showWhatsappToken ? "Hide Token" : "Show Token"}
                                >
                                    {showWhatsappToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {hasExistingWhatsappToken && !whatsappToken && !showWhatsappToken && (
                                <p className="text-[9px] text-slate-400 italic">Saved token is hidden for security. Type to overwrite.</p>
                            )}
                        </div>
                    </div>

                    <label className={`flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer ${!whatsappEnabled ? 'opacity-40' : ''}`}>
                        <input type="checkbox" checked={whatsappAutoSendBill} onChange={(e) => setWhatsappAutoSendBill(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 italic">Auto-send Bill PDFs</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Automatically notify patients on payment</span>
                        </div>
                    </label>
                </CardContent>
            </Card>

            {/* 4. AI & AUTOMATION (Gemini) */}
            <Card className="border-indigo-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 border-l-4 border-l-indigo-600">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <CardTitle className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 italic font-black">
                        <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                        AI POWERED AUTOMATION
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Configure Google Gemini for Invoice & PDF Scanning</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-indigo-500" />
                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 italic">Enable AI Scanning</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Auto-populate Purchase Entries from PDF bills</p>
                            </div>
                        </div>
                        <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                    </div>

                    <div className={`space-y-4 ${!aiEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                Google Gemini API Key
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline">Get Free Key →</a>
                            </Label>
                            <div className="relative">
                                <Input 
                                    type={showAiApiKey ? 'text' : 'password'} 
                                    value={aiApiKey} 
                                    onChange={e => setAiApiKey(e.target.value)} 
                                    placeholder={
                                        aiApiKey 
                                            ? 'Entering new key...' 
                                            : hasExistingAiKey 
                                                ? (showAiApiKey ? '[KEY SAVED & PROTECTED]' : '✓ AI SERVICE ACTIVE')
                                                : 'Enter your Gemini API Key here'
                                    } 
                                    className={`font-mono text-sm border-2 rounded-xl pr-10 ${hasExistingAiKey && !aiApiKey ? 'bg-indigo-50/10 border-indigo-200' : 'border-slate-200'}`} 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowAiApiKey(!showAiApiKey)} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showAiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium italic">
                                * This key will be stored securely in your database. Using the database key is more stable than .env files.
                            </p>
                        </div>
                        
                        <div className="pt-2">
                             <Button 
                                type="button" 
                                onClick={handleTestAi} 
                                 disabled={loading || (!aiApiKey && !hasExistingAiKey)}
                                className="w-full bg-slate-900 hover:bg-black text-white rounded-xl font-bold gap-2 py-6 border-2 border-indigo-500/30"
                            >
                                <Zap className="h-4 w-4 text-indigo-400" />
                                TEST AI NOW [VER 4]
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 5. Network & Server Configuration */}
            <Card className="border-blue-200 dark:border-blue-900/50 shadow-md bg-white dark:bg-slate-900 border-t-4 border-t-blue-500">
                <CardHeader className="bg-blue-50/30 dark:bg-blue-950/20">
                    <CardTitle className="flex items-center gap-3 text-blue-900 dark:text-blue-100 italic font-black">
                        <Database className="h-5 w-5 text-blue-600" />
                        NETWORK GATEWAY CONFIG
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-blue-600/70 uppercase tracking-widest">Configure how the system is accessed on your network</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 mb-4">
                        <div className="flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
                            <div>
                                <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase italic">Production Network Stability</h4>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-1 leading-relaxed">
                                    The "App URL" is used for system-wide redirects, WhatsApp notification links, and QR codes.
                                    In a Hospital LAN setup, this should be the Fixed IP of your server (e.g. http://192.168.1.10:3002).
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                Preferred App Gateway URL
                                <span className="text-blue-600 font-bold uppercase tracking-widest opacity-50">Local Detection: {localOrigin}</span>
                            </Label>
                            <div className="flex gap-2">
                                <Input 
                                    value={appUrl} 
                                    onChange={e => setAppUrl(e.target.value)} 
                                    placeholder="http://192.168.x.x:3002" 
                                    className="font-mono text-sm border-2 rounded-xl focus:border-blue-500 transition-all" 
                                />
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setAppUrl(window.location.origin)}
                                    className="rounded-xl border-2 font-black text-[10px] uppercase px-4 h-11"
                                >
                                    AUTO-DETECT
                                </Button>
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium italic">
                                * This is updated automatically during startup via START_HOSPITAL_NEW.bat.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. Financial & White-Labeling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-100 italic font-black text-sm">
                            <Coins className="h-4 w-4 text-indigo-600" />
                            SYSTEM & FINANCIAL DEFAULTS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Currency</Label>
                            <div className="min-h-[40px]">
                                {isMounted ? (
                                    <Select value={currencyId} onValueChange={setCurrencyId}>
                                        <SelectTrigger className="font-bold rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                                        <SelectContent>{currencies.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                ) : (
                                    <div className="h-10 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Bill/Invoice Prefix</Label>
                                <Input 
                                    value={invoicePrefix} 
                                    onChange={e => setInvoicePrefix(e.target.value)} 
                                    className="font-black rounded-xl uppercase" 
                                    placeholder="INV"
                                />
                                <p className="text-[9px] text-slate-400 italic">Example: INV-001</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Start Number</Label>
                                <Input 
                                    type="number"
                                    value={invoiceStartNumber} 
                                    onChange={e => setInvoiceStartNumber(e.target.value)} 
                                    className="font-black rounded-xl" 
                                    placeholder="1"
                                />
                                <p className="text-[9px] text-slate-400 italic">Sequential Start Index</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient ID Mode</Label>
                                {isMounted ? (
                                    <Select value={patientIdMode} onValueChange={setPatientIdMode}>
                                        <SelectTrigger className="font-bold rounded-xl"><SelectValue placeholder="Mode" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="timestamp">Timestamp (Random)</SelectItem>
                                            <SelectItem value="sequential">Sequential Logic</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="h-10 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient ID Prefix</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={patientIdPrefix} 
                                        onChange={e => setPatientIdPrefix(e.target.value)} 
                                        className="font-black rounded-xl w-24 uppercase text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500" 
                                        placeholder="PAT"
                                    />
                                    <Input 
                                        type="number"
                                        value={patientIdStartNumber} 
                                        onChange={e => setPatientIdStartNumber(e.target.value)} 
                                        className="font-black rounded-xl flex-1 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500" 
                                        placeholder="1000"
                                        disabled={patientIdMode !== 'sequential'}
                                    />
                                </div>
                                <p className="text-[9px] text-slate-400 italic">Ex: PAT-1000 (Mode: {patientIdMode})</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rounding Precision (Decimals)</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                max="4" 
                                value={roundingPrecision} 
                                onChange={e => setRoundingPrecision(parseInt(e.target.value))} 
                                className="font-black rounded-xl" 
                            />
                            <p className="text-[9px] text-slate-400 italic">Example: 2 =&gt; 10.00, 0 =&gt; 10</p>
                        </div>
                        
                        <div className="space-y-2 pt-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Date Format</Label>
                            <div className="min-h-[40px]">
                                {isMounted ? (
                                    <Select value={dateFormat} onValueChange={setDateFormat}>
                                        <SelectTrigger className="font-bold rounded-xl">
                                            <SelectValue placeholder="Select date format" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PPP">Default (e.g. May 24th, 2024)</SelectItem>
                                            <SelectItem value="dd/MM/yyyy">European (24/05/2024)</SelectItem>
                                            <SelectItem value="MM/dd/yyyy">US (05/24/2024)</SelectItem>
                                            <SelectItem value="yyyy-MM-dd">ISO (2024-05-24)</SelectItem>
                                            <SelectItem value="dd MMM yyyy">Short Month (24 May 2024)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="h-10 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {(isTenantAdmin || isAdmin) && (
                    <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm border-t-4 border-t-indigo-400">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 italic font-black text-sm">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                REGIONAL SETTINGS
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                    Hospital Timezone <br/>
                                    <span className="text-[9px] text-slate-500 font-medium italic lowercase">
                                        Current Local Time: {isMounted ? new Date().toLocaleString("en-US", {timeZone: timezone}) : 'Loading...'}
                                    </span>
                                </Label>
                                <div className="min-h-[40px]">
                                    {isMounted ? (
                                        <Select value={timezone} onValueChange={setTimezone}>
                                            <SelectTrigger className="font-bold rounded-xl h-11 border-2">
                                                <SelectValue placeholder="Select timezone" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                <SelectItem value="Asia/Kolkata">India (IST) - Asia/Kolkata</SelectItem>
                                                <SelectItem value="UTC">Universal Time (UTC)</SelectItem>
                                                <SelectItem value="Asia/Dubai">Gulf (GST) - Asia/Dubai</SelectItem>
                                                <SelectItem value="Africa/Nairobi">Nairobi/Kenya - Africa/Nairobi</SelectItem>
                                                <SelectItem value="Europe/London">London (GMT) - Europe/London</SelectItem>
                                                <SelectItem value="America/New_York">New York (EST) - America/New_York</SelectItem>
                                                <SelectItem value="Singapore">Singapore (SGT) - Singapore</SelectItem>
                                                {/* Dynamic values could be added here */}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="h-11 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional Locale</Label>
                                <div className="min-h-[40px]">
                                    {isMounted ? (
                                        <Select value={locale} onValueChange={setLocale}>
                                            <SelectTrigger className="font-bold rounded-xl h-11 border-2">
                                                <SelectValue placeholder="Select locale" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en-IN">English (India) - en-IN</SelectItem>
                                                <SelectItem value="en-US">English (US) - en-US</SelectItem>
                                                <SelectItem value="en-GB">English (UK) - en-GB</SelectItem>
                                                <SelectItem value="en-AE">English (UAE) - en-AE</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="h-11 w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 animate-pulse" />
                                    )}
                                </div>
                                <p className="text-[9px] text-slate-400 italic leading-relaxed">
                                    Determines how dates, numbers, and currencies are displayed.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 flex justify-center">
                <div className="max-w-4xl w-full flex justify-end">
                    <Button type="submit" disabled={loading} className="px-10 py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-2xl transition-all hover:-translate-y-1 active:scale-95">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                        SAVE ALL SETTINGS
                    </Button>
                </div>
            </div>
        </form>
    )
}
