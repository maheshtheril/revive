'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { updateHMSSettings, updatePaymentGatewaySettings, updateWhatsAppSettings, updatePDFSettings, setAsDefaultTemplate, deletePDFTemplate, renamePDFCategory, updateAISettings, resetWhatsAppSession } from "@/app/actions/settings"
import { Shield, CreditCard, Save, Calendar, Sparkles, AlertCircle, CheckCircle, Stethoscope, Eye, EyeOff, MessageSquare, FileText, AlignLeft, AlignCenter, AlignRight, Printer, Zap, X, Loader2, Trash2, Layout } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { PremiumPrintHeader } from "@/components/print/premium-print-header"
import { VisualInvoiceDesigner } from "@/components/print/visual-header-designer"
import { VisualOpSlipDesigner } from "@/components/print/visual-op-slip-designer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function HMSSettingsForm({ settings, products, doctors = [], gatewaySettings, whatsappSettings, pdfSettings, aiSettings, company }: { settings: any, products: any[], doctors?: any[], gatewaySettings?: any, whatsappSettings?: any, pdfSettings?: any, aiSettings?: any, company: any }) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string, debug?: string } | null>(null)

    const [registrationFee, setRegistrationFee] = useState(settings.registrationFee)
    const [registrationValidity, setRegistrationValidity] = useState(settings.registrationValidity)
    const [enableCardIssuance, setEnableCardIssuance] = useState(settings.enableCardIssuance)
    const [selectedProductId, setSelectedProductId] = useState(settings.registrationProductId)
    const [consultationBillingMode, setConsultationBillingMode] = useState(settings.consultationBillingMode || 'post_visit')
    const [defaultDoctorId, setDefaultDoctorId] = useState(settings.defaultDoctorId || '')
    const [opSlipPreprintedLetterhead, setOpSlipPreprintedLetterhead] = useState(settings.opSlipPreprintedLetterhead ?? false)
    const [opSlipHeaderHeight, setOpSlipHeaderHeight] = useState<string>(settings.opSlipHeaderHeight || '4.5')
    const [billPreprintedLetterhead, setBillPreprintedLetterhead] = useState(settings.billPreprintedLetterhead ?? false)
    const [billHeaderHeight, setBillHeaderHeight] = useState<string>(settings.billHeaderHeight || '4.5')
    const [allowRateEdit, setAllowRateEdit] = useState(settings.allowRateEdit ?? true)
    
    // OP Slip Customization State
    const [opSlipShowVitals, setOpSlipShowVitals] = useState(settings.opSlipShowVitals ?? true)
    const [opSlipVitalsPosition, setOpSlipVitalsPosition] = useState<'left' | 'right'>(settings.opSlipVitalsPosition || 'right')
    const [opSlipVitalsList, setOpSlipVitalsList] = useState<string[]>(settings.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'])
    const [opSlipRxStyle, setOpSlipRxStyle] = useState<'centered_small' | 'large_left' | 'none'>(settings.opSlipRxStyle || 'centered_small')
    const [opSlipCoordinates, setOpSlipCoordinates] = useState(settings.opSlipCoordinates || null)
    const [useCustomOpSlipLayout, setUseCustomOpSlipLayout] = useState(!!settings.opSlipCoordinates)

    // Bridge Status
    const [bridgeStatus, setBridgeStatus] = useState<{ connected: boolean, hasQr: boolean } | null>(null)
    const [qrTime, setQrTime] = useState(Date.now())

    // Payment Gateway Settings
    const [gatewayEnabled, setGatewayEnabled] = useState(gatewaySettings?.enabled ?? false)
    const [gatewayKeyId, setGatewayKeyId] = useState(gatewaySettings?.keyId ?? '')
    const [gatewayKeySecret, setGatewayKeySecret] = useState('')  // Never pre-filled for security
    const [gatewayUpiVpa, setGatewayUpiVpa] = useState(gatewaySettings?.upiVpa ?? '')
    const [gatewayBusinessName, setGatewayBusinessName] = useState(gatewaySettings?.businessName ?? '')
    const [showSecret, setShowSecret] = useState(false)
    const [hasExistingSecret, setHasExistingSecret] = useState(gatewaySettings?.hasKeySecret ?? false)

    // WhatsApp Settings
    const [whatsappEnabled, setWhatsappEnabled] = useState(whatsappSettings?.enabled ?? true)
    const [whatsappProvider, setWhatsappProvider] = useState<'ultramsg' | 'evolution'>(whatsappSettings?.provider || 'evolution')
    const [whatsappInstanceId, setWhatsappInstanceId] = useState(whatsappSettings?.instanceId ?? 'ZIONA-HMS')
    const [whatsappToken, setWhatsappToken] = useState('') // Masked
    const [whatsappAutoSendBill, setWhatsappAutoSendBill] = useState(whatsappSettings?.autoSendBill ?? true)
    const [showWhatsappToken, setShowWhatsappToken] = useState(false)
    const [hasExistingWhatsappToken, setHasExistingWhatsappToken] = useState(whatsappSettings?.hasToken ?? false)

    // PDF Print Settings
    const [pdfHeaderAlignment, setPdfHeaderAlignment] = useState<'left' | 'center' | 'right'>(pdfSettings?.headerAlignment || 'right')
    const [pdfShowLogo, setPdfShowLogo] = useState(pdfSettings?.showLogo ?? true)
    const [pdfHospitalNameSize, setPdfHospitalNameSize] = useState(pdfSettings?.hospitalNameSize || 16)
    const [pdfAddressSize, setPdfAddressSize] = useState(pdfSettings?.addressSize || 10)
    const [pdfShowContactInfo, setPdfShowContactInfo] = useState(pdfSettings?.showContactInfo ?? true)
    const [pdfAutoPrint, setPdfAutoPrint] = useState(pdfSettings?.autoPrint ?? false)
    const [pdfShowTaxInvoiceTitle, setPdfShowTaxInvoiceTitle] = useState(pdfSettings?.showTaxInvoiceTitle ?? true)
    const [pdfPrimaryColor, setPdfPrimaryColor] = useState(pdfSettings?.primaryColor || '#4f46e5')
    const [pdfBankDetails, setPdfBankDetails] = useState(pdfSettings?.bankDetails || '')
    const [pdfLogoLayout, setPdfLogoLayout] = useState<'beside' | 'stack'>(pdfSettings?.logoLayout || 'beside');
    const [pdfLogoPosition, setPdfLogoPosition] = useState<'left' | 'center' | 'right'>(pdfSettings?.logoPosition || 'left');
    const [pdfLogoSize, setPdfLogoSize] = useState(pdfSettings?.logoSize || 80);
    const [pdfCoordinates, setPdfCoordinates] = useState(pdfSettings?.coordinates || null);
    const [useCustomLayout, setUseCustomLayout] = useState(!!pdfSettings?.coordinates);
    const [showVisualDesigner, setShowVisualDesigner] = useState(false);
    const [designerTab, setDesignerTab] = useState<'invoice' | 'op_slip'>('invoice');

    // AI Settings Mirror
    const [aiEnabled, setAiEnabled] = useState(aiSettings?.enabled ?? true)
    const [aiApiKey, setAiApiKey] = useState('')
    const [aiModel, setAiModel] = useState(aiSettings?.model || 'gemini-1.5-flash')
    const [showAiApiKey, setShowAiApiKey] = useState(false)
    const [hasExistingAiKey, setHasExistingAiKey] = useState(aiSettings?.hasKey ?? false)

    // Sync local state when settings props change
    useEffect(() => {
        setRegistrationFee(settings.registrationFee);
        setRegistrationValidity(settings.registrationValidity);
        setEnableCardIssuance(settings.enableCardIssuance);
        setSelectedProductId(settings.registrationProductId);
        setConsultationBillingMode(settings.consultationBillingMode || 'post_visit');
        setDefaultDoctorId(settings.defaultDoctorId || '');
        setOpSlipPreprintedLetterhead(settings.opSlipPreprintedLetterhead ?? false);
        setOpSlipHeaderHeight(settings.opSlipHeaderHeight || '4.5');
        setBillPreprintedLetterhead(settings.billPreprintedLetterhead ?? false);
        setBillHeaderHeight(settings.billHeaderHeight || '4.5');
        setAllowRateEdit(settings.allowRateEdit ?? true);
        setOpSlipCoordinates(settings.opSlipCoordinates || null);
        setUseCustomOpSlipLayout(!!settings.opSlipCoordinates);
    }, [settings]);

    useEffect(() => {
        if (gatewaySettings) {
            setGatewayEnabled(gatewaySettings.enabled ?? false);
            setGatewayKeyId(gatewaySettings.keyId ?? '');
            setGatewayUpiVpa(gatewaySettings.upiVpa ?? '');
            setGatewayBusinessName(gatewaySettings.businessName ?? '');
            setHasExistingSecret(gatewaySettings.hasKeySecret ?? false);
        }
    }, [gatewaySettings]);

    useEffect(() => {
        if (whatsappSettings) {
            setWhatsappEnabled(whatsappSettings.enabled ?? false);
            setWhatsappProvider(whatsappSettings.provider || 'ultramsg');
            setWhatsappInstanceId(whatsappSettings.instanceId ?? '');
            setWhatsappAutoSendBill(whatsappSettings.autoSendBill ?? false);
            // Ensure we update the existence flag from the server source of truth
            setHasExistingWhatsappToken(whatsappSettings.hasToken ?? false);
        }
    }, [whatsappSettings, whatsappSettings?.hasToken]);

    useEffect(() => {
        if (pdfSettings) {
            // NEW WORLD SYNC: Resolve active templates for both financial and clinical
            const billId = pdfSettings.usageDefaults?.['sale_bill'];
            const opId = pdfSettings.usageDefaults?.['op_slip'];
            
            const billTemplate = pdfSettings.templates?.find((t: any) => t.id === billId);
            const opTemplate = pdfSettings.templates?.find((t: any) => t.id === opId);

            // 1. Financial Sync (Sale Bill)
            const billConfig = billTemplate?.config || pdfSettings; 
            setPdfHeaderAlignment(billConfig.headerAlignment || 'right');
            setPdfShowLogo(billConfig.showLogo ?? true);
            setPdfHospitalNameSize(billConfig.hospitalNameSize || 16);
            setPdfAddressSize(billConfig.addressSize || 10);
            setPdfShowContactInfo(billConfig.showContactInfo ?? true);
            setPdfAutoPrint(billConfig.autoPrint ?? false);
            setPdfShowTaxInvoiceTitle(billConfig.showTaxInvoiceTitle ?? true);
            setPdfPrimaryColor(billConfig.primaryColor || '#4f46e5');
            setPdfBankDetails(billConfig.bankDetails || '');
            setPdfLogoLayout(billConfig.logoLayout || 'beside');
            setPdfLogoPosition(billConfig.logoPosition || 'left');
            setPdfLogoSize(billConfig.logoSize || 80);
            
            const billCoords = billTemplate?.config?.coordinates || billTemplate?.config || pdfSettings.coordinates || null;
            setPdfCoordinates(billCoords);
            setUseCustomLayout(!!billCoords);

            // 2. Clinical Sync (OP Slip)
            const opCoords = opTemplate?.config?.coordinates || opTemplate?.config || settings.opSlipCoordinates || null;
            setOpSlipCoordinates(opCoords);
            setUseCustomOpSlipLayout(!!opCoords);
        }
    }, [pdfSettings, settings.opSlipCoordinates]);

    useEffect(() => {
        if (aiSettings) {
            setAiEnabled(aiSettings.enabled ?? true);
            setHasExistingAiKey(aiSettings.hasKey ?? false);
        }
    }, [aiSettings]);

    // Poll WhatsApp Bridge Status
    useEffect(() => {
        if (!whatsappEnabled || whatsappProvider !== 'evolution') return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:8081/status`);
                if (res.ok) {
                    const data = await res.json();
                    setBridgeStatus(data);
                    if (data.hasQr) setQrTime(Date.now()); // Force image refresh
                } else {
                    setBridgeStatus(null);
                }
            } catch (err) {
                setBridgeStatus(null);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [whatsappEnabled, whatsappProvider]);

    const handleWhatsappLogout = async () => {
        if (!confirm("Are you sure you want to disconnect WhatsApp and change to another mobile?")) return;
        setLoading(true);
        try {
            const res = await fetch(`http://${window.location.hostname}:8081/logout`, { method: 'POST' });
            if (res.ok) {
                toast({ title: "Disconnected", description: "Old session wiped. Restarting bridge..." });
                setBridgeStatus(null);
            } else {
                // If local bridge is unreachable, try direct file reset
                const coldRes = await resetWhatsAppSession();
                if (coldRes.success) {
                    toast({ title: "Session Reset", description: "Login files deleted via server. Restart Bridge." });
                    setBridgeStatus(null);
                } else {
                    throw new Error("Local Bridge Bridge unreachable.");
                }
            }
        } catch (err: any) {
            // Fallback to cold reset on connection error
            const coldRes = await resetWhatsAppSession();
            if (coldRes.success) {
                toast({ title: "Emergency Reset", description: "Login files deleted. Restart BRIDGE manually." });
                setBridgeStatus(null);
            } else {
                toast({ title: "Error", description: "Could not reach bridge or reset files.", variant: "destructive" });
            }
        } finally {
            setLoading(false);
        }
    }

    const handleTestAi = async () => {
        setLoading(true);
        toast({ title: "Testing AI...", description: "Connecting to Google Gemini..." });

        try {
            const res = await fetch('/api/ai-test', {
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
                toast({ 
                    title: "AI Test FAILED ✗", 
                    description: result.error || "Connection error. Please check your key.", 
                    variant: "destructive" 
                });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        const loadingToast = toast({
            title: "Saving Configuration",
            description: "Updating hospital settings and products...",
        });

        try {
            const [res, gatewayRes, whatsappRes, pdfRes, aiRes] = await Promise.all([
                updateHMSSettings({
                    registrationFee: parseFloat(String(registrationFee)),
                    registrationValidity: parseInt(String(registrationValidity)),
                    enableCardIssuance: !!enableCardIssuance,
                    consultationBillingMode: consultationBillingMode,
                    opSlipPreprintedLetterhead: !!opSlipPreprintedLetterhead,
                    opSlipHeaderHeight: opSlipHeaderHeight || '4.5',
                    billPreprintedLetterhead: !!billPreprintedLetterhead,
                    billHeaderHeight: billHeaderHeight || '4.5',
                    opSlipShowVitals: !!opSlipShowVitals,
                    opSlipVitalsPosition: opSlipVitalsPosition,
                    opSlipVitalsList: opSlipVitalsList,
                    opSlipRxStyle: opSlipRxStyle,
                    productId: selectedProductId,
                    defaultDoctorId: defaultDoctorId || null,
                    allowRateEdit: allowRateEdit
                }),
                updatePaymentGatewaySettings({
                    enabled: gatewayEnabled,
                    keyId: gatewayKeyId,
                    keySecret: gatewayKeySecret || undefined,
                    upiVpa: gatewayUpiVpa,
                    businessName: gatewayBusinessName,
                }),
                updateWhatsAppSettings({
                    enabled: whatsappEnabled,
                    provider: whatsappProvider,
                    instanceId: whatsappInstanceId,
                    token: whatsappToken || undefined,
                    autoSendBill: whatsappAutoSendBill
                }),
                // Save active templates for both usage types
                updatePDFSettings({
                    id: pdfSettings?.usageDefaults?.['sale_bill'] || 'default_bill',
                    name: pdfSettings?.templates?.find((t: any) => t.id === pdfSettings?.usageDefaults?.['sale_bill'])?.name || 'Standard Bill',
                    usage: 'sale_bill',
                    config: {
                        headerAlignment: pdfHeaderAlignment,
                        showLogo: pdfShowLogo,
                        hospitalNameSize: pdfHospitalNameSize,
                        addressSize: pdfAddressSize,
                        showContactInfo: pdfShowContactInfo,
                        autoPrint: pdfAutoPrint,
                        showTaxInvoiceTitle: pdfShowTaxInvoiceTitle,
                        primaryColor: pdfPrimaryColor,
                        bankDetails: pdfBankDetails,
                        logoLayout: pdfLogoLayout,
                        logoPosition: pdfLogoPosition,
                        logoSize: pdfLogoSize,
                        coordinates: pdfCoordinates
                    },
                    isDefault: true
                }),
                updatePDFSettings({
                    id: pdfSettings?.usageDefaults?.['op_slip'] || 'default_op',
                    name: pdfSettings?.templates?.find((t: any) => t.id === pdfSettings?.usageDefaults?.['op_slip'])?.name || 'Standard OP',
                    usage: 'op_slip',
                    config: {
                        coordinates: opSlipCoordinates,
                        logoSize: pdfLogoSize // Share logo size for consistency
                    },
                    isDefault: true
                }),
                updateAISettings({
                    enabled: aiEnabled,
                    apiKey: aiApiKey || undefined
                })
            ]);

            if (!res.success) throw new Error(res.error || "Failed to save HMS settings");
            if (!gatewayRes.success) throw new Error(gatewayRes.error || "Failed to save Gateway settings");
            if (!whatsappRes.success) throw new Error(whatsappRes.error || "Failed to save WhatsApp settings");
            if (!pdfRes.success) throw new Error(pdfRes.error || "Failed to save PDF settings");
            if (!aiRes.success) throw new Error(aiRes.error || "Failed to save AI configuration");

            if (loadingToast) loadingToast.dismiss();

            setMsg({ type: 'success', text: 'Configuration saved successfully.' });
            toast({ title: "Success", description: "All settings updated." });

            if (gatewayKeySecret) { setGatewayKeySecret(''); setHasExistingSecret(true); }
            if (whatsappToken) { setWhatsappToken(''); setHasExistingWhatsappToken(true); }
            if (aiApiKey) { setAiApiKey(''); setHasExistingAiKey(true); }

            router.refresh();
        } catch (err: any) {
            if (loadingToast) loadingToast.dismiss();
            setMsg({ type: 'error', text: err.message || 'Failed to save configuration' });
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Version Badge for Confidence */}
            <div className="flex justify-end -mb-4">
                <div className="px-3 py-1 bg-slate-900/80 backdrop-blur-md text-white rounded-full text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-slate-700 shadow-lg">
                    <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    ZIONA v3.5 - Enterprise Gold
                </div>
            </div>
            {/* Status Message */}
            {msg && (
                <div className={`p-5 rounded-2xl flex flex-col gap-2 border shadow-sm ${msg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        {msg.type === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-sm font-black uppercase tracking-tight">{msg.text}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Registration Product Mapping */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">Financial Mapping</span>
                            </div>
                            <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 italic">Registration Service Product</h3>
                        </div>
                    </div>
                    <select
                        value={selectedProductId || ''}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                        <option value="">-- AUTO-PILOT (System searches for Registration Product) --</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} [{p.sku}] - ₹{parseFloat(p.price || '0').toFixed(2)}</option>
                        ))}
                    </select>
                </div>

                {/* Default Doctor */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em] bg-teal-50 dark:bg-teal-900/40 px-2 py-0.5 rounded-md">OP Booking</span>
                            </div>
                            <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 italic">Default Doctor</h3>
                        </div>
                    </div>
                    <select
                        value={defaultDoctorId}
                        onChange={(e) => setDefaultDoctorId(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer"
                    >
                        <option value="">-- None (Manual Selection) --</option>
                        {doctors.map(d => (
                            <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name || ''}</option>
                        ))}
                    </select>
                </div>

                {/* Registration Fee */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Fee Amount</h3>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                        <input
                            type="number"
                            value={registrationFee}
                            onChange={(e) => setRegistrationFee(e.target.value)}
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-lg outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Registration Validity */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Validity Period</h3>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            value={registrationValidity}
                            onChange={(e) => setRegistrationValidity(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-lg outline-none focus:border-emerald-500"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-wider">Days</div>
                    </div>
                </div>

                {/* Patient ID Card Issuance */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">Patient ID Cards</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Allow generating digital ID cards</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={enableCardIssuance} onChange={(e) => setEnableCardIssuance(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>
                </div>

                {/* WhatsApp Notification Service - MOVED TO TOP FOR VISIBILITY */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border-2 border-emerald-500/20 dark:border-emerald-500/10 rounded-3xl p-6 shadow-xl shadow-emerald-500/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3">
                        <div className={`h-2 w-2 rounded-full ${bridgeStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                                <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 italic">WhatsApp Notification Service</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Automated Patient Communication</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-14 h-7 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!whatsappEnabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Service Provider</Label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappProvider('ultramsg')}
                                        className={`px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${whatsappProvider === 'ultramsg' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        UltraMsg (Paid)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappProvider('evolution')}
                                        className={`px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${whatsappProvider === 'evolution' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Evolution (Free)
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Instance / Bridge Name</Label>
                                <input 
                                    type="text" 
                                    value={whatsappInstanceId} 
                                    onChange={(e) => setWhatsappInstanceId(e.target.value)} 
                                    placeholder={whatsappProvider === 'evolution' ? "Bridge Name (Default: ZIONA)" : "Instance ID (digits only)"} 
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold" 
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">API Authentication Token</Label>
                                <div className="relative">
                                    <input 
                                        type={showWhatsappToken ? 'text' : 'password'} 
                                        value={whatsappToken} 
                                        onChange={(e) => setWhatsappToken(e.target.value)} 
                                        placeholder={
                                            whatsappToken 
                                                ? 'Entering new key...' 
                                                : hasExistingWhatsappToken 
                                                    ? (showWhatsappToken ? '[SECURE KEY SAVED]' : '✓ KEY SAVED')
                                                    : whatsappProvider === 'evolution' 
                                                        ? 'Evolution Apikey (Optional)'
                                                        : 'UltraMsg API Token'
                                        } 
                                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono ${hasExistingWhatsappToken && !whatsappToken ? 'border-emerald-500/30' : ''}`} 
                                    />
                                    <button type="button" onClick={() => setShowWhatsappToken(!showWhatsappToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 transition-colors">
                                        {showWhatsappToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl cursor-pointer border border-emerald-100/50 dark:border-emerald-900/20">
                                <input type="checkbox" checked={whatsappAutoSendBill} onChange={(e) => setWhatsappAutoSendBill(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
                                <div>
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Auto-send Bill PDFs</span>
                                    <p className="text-[10px] text-slate-500 font-medium">Sends invoice to patient immediately after save.</p>
                                </div>
                            </label>
                        </div>

                        {/* Pairing / QR Code Area */}
                        <div className="bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center relative min-h-[300px]">
                            {whatsappProvider === 'evolution' ? (
                                <>
                                    {bridgeStatus?.connected ? (
                                        <div className="text-center space-y-4">
                                            <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <CheckCircle className="h-10 w-10 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-emerald-600 uppercase tracking-tight">System Connected</h4>
                                                <p className="text-xs text-slate-500 font-bold">Your phone is linked to the hospital bridge.</p>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleWhatsappLogout}
                                                className="mt-4 px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                                            >
                                                <X className="h-4 w-4" /> Disconnect Device
                                            </button>
                                        </div>
                                    ) : bridgeStatus?.hasQr ? (
                                        <div className="text-center space-y-4">
                                            <div className="bg-white p-3 rounded-2xl shadow-2xl ring-1 ring-slate-100 inline-block">
                                                <img 
                                                    src={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8081/qr?t=${qrTime}`} 
                                                    alt="WhatsApp QR Code" 
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Scan with WhatsApp</h4>
                                                <p className="text-[9px] text-slate-400 font-bold">Linked Devices &gt; Link a Device</p>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleWhatsappLogout}
                                                className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                                            >
                                                Wipe Session & Retry
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-3">
                                            <Loader2 className="h-10 w-10 text-slate-300 animate-spin mx-auto" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                {whatsappEnabled ? "Connecting to local bridge..." : "Enable WhatsApp to pair device."}
                                            </p>
                                            {whatsappEnabled && (
                                                <p className="text-[9px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">Ensure RUN_WHATSAPP.bat is active on the server PC.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center space-y-4 p-4">
                                    <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto">
                                        <Shield className="h-8 w-8 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">UltraMsg Active</h4>
                                        <p className="text-[10px] text-slate-500 font-bold mt-1">Status managed via UltraMsg Dashboard</p>
                                    </div>
                                    <a href="https://ultramsg.com" target="_blank" className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Check UltraMsg Status &rarr;</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* AI & Automation (Gemini) - Premium Automation Node */}
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20">
                        <Sparkles className="h-24 w-24 text-indigo-400" />
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-indigo-400 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-white italic">AI Powered Automation</h3>
                                <p className="text-xs text-indigo-300 font-bold uppercase mt-0.5 tracking-widest">Google Gemini Vision AI Integration</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-14 h-7 bg-slate-700/50 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${!aiEnabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-black uppercase text-indigo-300 ml-1 flex justify-between">
                                    Gemini Vision API Key
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 hover:text-indigo-300 underline font-bold tracking-tight">Generate Key →</a>
                                </Label>
                                <div className="relative">
                                    <input 
                                        type={showAiApiKey ? 'text' : 'password'} 
                                        value={aiApiKey} 
                                        onChange={(e) => setAiApiKey(e.target.value)} 
                                        placeholder={aiApiKey ? 'Entering new key...' : hasExistingAiKey ? '[SECURE AI KEY ACTIVE]' : 'Paste Gemini-1.5 API Key'} 
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 font-mono"
                                    />
                                    <button type="button" onClick={() => setShowAiApiKey(!showAiApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                                        {showAiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleTestAi} disabled={loading || (!aiApiKey && !hasExistingAiKey)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                                    <Zap className="h-4 w-4" /> Test AI
                                </button>
                                {hasExistingAiKey && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if(confirm("Restore to original .env key?")) {
                                                const res = await updateAISettings({ enabled: aiEnabled, apiKey: "", reset: true });
                                                if(res.success) { setHasExistingAiKey(false); setAiApiKey(""); toast({ title: "AI Reset", description: "Using default .env key." }); }
                                            }
                                        }}
                                        className="px-4 bg-slate-800 text-slate-400 border border-white/5 rounded-xl hover:text-red-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 opacity-60">
                                <Label className="text-[10px] font-black uppercase text-indigo-300">AI Model Engine</Label>
                                <select value={aiModel || "gemini-2.0-flash"} onChange={(e) => setAiModel(e.target.value)} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none" disabled>
                                    <option value="gemini-1.5-flash">google/gemini-1.5-flash (Stable)</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4 text-blue-400" />
                                </div>
                                <p className="text-[10px] text-blue-100/70 font-bold leading-relaxed">Auto-extract items, tax, and totals from PDF/Image invoices for high-speed entries.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                </div>
                                <p className="text-[10px] text-emerald-100/70 font-bold leading-relaxed">Multimodal AI ensures 99.8% precision for complex pharmaceutical receipts.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consultation Billing Mode */}
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-6 shadow-sm group">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 italic">Consultation Billing Mode</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'at_booking', label: 'At Booking', icon: '⚡' },
                            { id: 'post_visit', label: 'After Visit', icon: '🩺' },
                            { id: 'none', label: 'Manual Only', icon: '🚫' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setConsultationBillingMode(mode.id)}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${consultationBillingMode === mode.id ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-md' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}
                            >
                                <span className="text-2xl">{mode.icon}</span>
                                <span className="text-xs font-black uppercase tracking-widest">{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Universal Branding Hub - ONE PLACE FOR ALL hospital stationery */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border-4 border-indigo-500/20 dark:border-indigo-500/10 rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 h-64 w-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
                    
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="h-20 w-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/40 transform group-hover:rotate-6 transition-transform">
                                <Layout className="h-10 w-10 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-3xl text-slate-900 dark:text-white italic tracking-tighter uppercase">Universal Branding Studio</h3>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full w-fit">Multi-Format Stationery Engine</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${useCustomLayout ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                    {useCustomLayout ? 'Studio Active' : 'Default Engine'}
                                </div>
                            </div>

                            <Dialog open={showVisualDesigner} onOpenChange={setShowVisualDesigner}>
                                <DialogTrigger asChild>
                                    <button 
                                        type="button"
                                        className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/40 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all border-b-4 border-indigo-800"
                                    >
                                        OPEN BRANDING STUDIO
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[98vw] w-fit h-[95vh] bg-slate-100 dark:bg-slate-950 p-0 border-0 flex flex-col shadow-2xl overflow-hidden rounded-[3rem]">
                                    <DialogHeader className="p-4 bg-white border-b border-slate-100 shrink-0">
                                        <div className="flex justify-between items-center pr-10">
                                            <div className="flex items-center gap-8">
                                                <div>
                                                    <DialogTitle className="text-2xl font-black italic text-slate-900 tracking-tighter uppercase">Universal branding hub</DialogTitle>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Hospital Stationery Engine v6.0</p>
                                                </div>
                                                
                                                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                                    <button 
                                                        onClick={() => setDesignerTab('invoice')}
                                                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${designerTab === 'invoice' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                        Financial Invoice
                                                    </button>
                                                    <button 
                                                        onClick={() => setDesignerTab('op_slip')}
                                                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${designerTab === 'op_slip' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-500'}`}
                                                    >
                                                        <Stethoscope className="h-4 w-4" />
                                                        Clinical OP Slip
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="hidden md:flex flex-col items-end mr-4">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-Save Protection</span>
                                                    <span className="text-[11px] font-black text-emerald-500">SYSTEM READY</span>
                                                </div>
                                                <button 
                                                    onClick={() => setShowVisualDesigner(false)} 
                                                    className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-black shadow-xl active:scale-95"
                                                >
                                                    Finalize Layout
                                                </button>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <div className="flex-1 overflow-auto p-4 md:p-12 flex justify-center bg-slate-100 dark:bg-slate-950">
                                        {designerTab === 'invoice' ? (
                                            <VisualInvoiceDesigner 
                                                company={company}
                                                bankDetails={pdfBankDetails}
                                                usageDefaults={pdfSettings?.usageDefaults}
                                                templates={pdfSettings?.templates}
                                                settings={{ 
                                                    logoSize: pdfLogoSize, 
                                                    hospitalNameSize: pdfHospitalNameSize, 
                                                    addressSize: pdfAddressSize, 
                                                    showLogo: pdfShowLogo, 
                                                    showContactInfo: pdfShowContactInfo,
                                                    coordinates: pdfCoordinates 
                                                }}
                                                onSave={(coords, usage) => {
                                                    if (usage === 'sale_bill') {
                                                        setPdfCoordinates(coords);
                                                        if (!useCustomLayout) setUseCustomLayout(true);
                                                    }
                                                }}
                                                onSaveTemplate={async (name, config, usage, id) => {
                                                    const res = await updatePDFSettings({
                                                        id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}`),
                                                        name,
                                                        usage,
                                                        config: { coordinates: config },
                                                        isDefault: (id === pdfSettings?.usageDefaults?.[usage] || !id || id === pdfSettings?.activeTemplateId)
                                                    });
                                                    if (res.success) {
                                                        toast({ title: "Template Saved", description: `'${name}' updated.` });
                                                        router.refresh();
                                                    }
                                                }}
                                                onSetDefault={async (id, usage) => {
                                                    const res = await setAsDefaultTemplate(id, usage);
                                                    if (res.success) {
                                                        const t = pdfSettings?.templates?.find((tmp: any) => tmp.id === id);
                                                        if (t) setPdfCoordinates(t.config?.coordinates || t.config);
                                                        toast({ title: "Primary Layout Set" });
                                                        router.refresh();
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <VisualOpSlipDesigner 
                                                company={company}
                                                templates={pdfSettings?.templates}
                                                usageDefaults={pdfSettings?.usageDefaults}
                                                settings={{ coordinates: opSlipCoordinates, logoSize: pdfLogoSize }}
                                                onSave={(v) => {
                                                    setOpSlipCoordinates(v);
                                                    if (!useCustomOpSlipLayout) setUseCustomOpSlipLayout(true);
                                                }}
                                                onSaveTemplate={async (name, config, usage, id) => {
                                                    const res = await updatePDFSettings({
                                                        id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}`),
                                                        name,
                                                        usage: 'op_slip',
                                                        config: { coordinates: config },
                                                        isDefault: true
                                                    });
                                                    if (res.success) {
                                                        toast({ title: "Clinical Template Active", description: "This layout is now your hospital's standard OP Slip." });
                                                        router.refresh();
                                                    }
                                                }}
                                                onSetDefault={async (id) => {
                                                    const res = await setAsDefaultTemplate(id, 'op_slip');
                                                    if (res.success) {
                                                        const t = pdfSettings?.templates?.find((tmp: any) => tmp.id === id);
                                                        if (t) setOpSlipCoordinates(t.config?.coordinates || t.config);
                                                        toast({ title: "Clinical Layout Active" });
                                                        router.refresh();
                                                    }
                                                }}
                                                onDeleteTemplate={async (id) => {
                                                    const res = await deletePDFTemplate(id);
                                                    if (res.success) {
                                                        toast({ title: "Template Purged" });
                                                        router.refresh();
                                                    }
                                                }}
                                            />
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 font-black uppercase text-[9px] tracking-widest text-slate-400">
                        <div className="flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-white dark:border-slate-800">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>Draggable Clinical Blocks</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-white dark:border-slate-800">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>Coordinate High-Fidelity</span>
                        </div>
                        <div className="flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-white dark:border-slate-800">
                            <CheckCircle className="h-4 w-4 text-indigo-500" />
                            <span>Precision Audit Trail</span>
                        </div>
                    </div>
                </div>

                {/* Payment Gateway */}
                <div className="md:col-span-2 bg-gradient-to-r from-violet-950 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-violet-800/40">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <Zap className="h-6 w-6 text-yellow-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Razorpay Gateway</h3>
                                <p className="text-xs text-violet-300 font-medium opacity-80">UPI QR Payments on Billing</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={gatewayEnabled} onChange={(e) => setGatewayEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!gatewayEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <input type="text" value={gatewayBusinessName} onChange={(e) => setGatewayBusinessName(e.target.value)} placeholder="Hospital Business Name" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40" />
                        <input type="text" value={gatewayUpiVpa} onChange={(e) => setGatewayUpiVpa(e.target.value)} placeholder="UPI ID (VPA)" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40" />
                        <input type="text" value={gatewayKeyId} onChange={(e) => setGatewayKeyId(e.target.value)} placeholder="Razorpay Key ID" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40" />
                        <div className="relative">
                            <input type={showSecret ? 'text' : 'password'} value={gatewayKeySecret} onChange={(e) => setGatewayKeySecret(e.target.value)} placeholder={hasExistingSecret ? '••••••••' : 'Key Secret'} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40" />
                            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 flex justify-center">
                <div className="max-w-4xl w-full flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-2xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="h-5 w-5" />}
                        <span>Save Settings</span>
                    </button>
                </div>
            </div>
        </form>
    )
}
