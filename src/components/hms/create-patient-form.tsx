'use client'

import { createPatientV10 as createPatient, createPatientQuick } from "@/app/actions/patient-v10"
import { recordPayment } from "@/app/actions/billing"
import { X, User, Phone, Calendar, Camera, FileText, Shield, MapPin, Mail, AlertCircle, CheckCircle2, Fingerprint, Activity, Printer, CreditCard, Banknote, Smartphone, Mic, MicOff } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileUpload } from "@/components/ui/file-upload"
import { VoiceWrapper } from "@/components/ui/voice-wrapper"
import { getHMSSettings } from "@/app/actions/settings"
import { PatientIDCard } from "@/components/hms/patient-id-card"


interface CreatePatientFormProps {
    tenantCountry?: string
    onClose?: () => void
    onSuccess?: (patient: any) => void
    isDialog?: boolean
    initialData?: any
    registrationFee?: number
    registrationProductId?: string | null
    registrationProductName?: string
    registrationProductDescription?: string
    appName?: string
    hideBilling?: boolean
}

export function CreatePatientForm({
    tenantCountry = 'IN',
    onClose,
    onSuccess,
    isDialog = false,
    initialData,
    registrationFee: propFee,
    registrationProductId: propId = null,
    registrationProductName: propName = 'Patient Registration Fee',
    registrationProductDescription: propDesc = 'Standard Service',
    appName = 'Health Registry',
    hideBilling = true
}: CreatePatientFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnPath = searchParams.get('returnPath');
    const autoSelect = searchParams.get('autoSelect') === 'true';

    const [activeTab, setActiveTab] = useState<'basic' | 'identity'>('basic');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [savedPatient, setSavedPatient] = useState<any>(null);
    const [showIDCard, setShowIDCard] = useState(false);
    const [printIDCard, setPrintIDCard] = useState(false);


    // Dynamic Settings State
    const [registrationFee, setRegistrationFee] = useState(propFee ?? 100);
    const [registrationValidity, setRegistrationValidity] = useState(0); // [RCM-FIX] Start at 0, sync from settings
    const [registrationProductId, setRegistrationProductId] = useState(propId);
    const [registrationProductName, setRegistrationProductName] = useState(propName);
    const [registrationProductDescription, setRegistrationProductDescription] = useState(propDesc);
    const [enableCardIssuanceSetting, setEnableCardIssuanceSetting] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const syncSettings = async () => {
            try {
                const res = await getHMSSettings();
                if (isMounted && res.success && res.settings) {
                    setRegistrationFee(res.settings.registrationFee);
                    setRegistrationValidity(res.settings.registrationValidity);
                    setRegistrationProductId(res.settings.registrationProductId);
                    setRegistrationProductName(res.settings.registrationProductName);
                    setRegistrationProductDescription(res.settings.registrationProductDescription);
                    setEnableCardIssuanceSetting(res.settings.enableCardIssuance);
                }
            } catch (err) {
                console.error("Failed to sync HMS settings:", err);
            }
        };
        syncSettings();
        return () => { isMounted = false; };
    }, [propFee]);

    // Keyboard Shortcut: Ctrl+S to Save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                const form = document.querySelector('form#patient-master-form') as HTMLFormElement
                if (form) {
                    form.requestSubmit()
                }
            }
            if (e.altKey && e.key === 'v') {
                e.preventDefault()
                startListening()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // State for Vault
    const [profileImageUrl, setProfileImageUrl] = useState(initialData?.profile_image_url || initialData?.metadata?.profile_image_url || '');
    const [idCardUrl, setIdCardUrl] = useState(initialData?.metadata?.id_card_url || '');

    // State for Age/DOB logic
    const calculateAge = (dobString: string) => {
        if (!dobString) return { age: '', unit: 'Years' };
        const birthDate = new Date(dobString);
        const today = new Date();
        let ageYears = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) ageYears--;
        return { age: ageYears.toString(), unit: 'Years' };
    };

    const initialAgeData = initialData?.dob ? calculateAge(initialData.dob.toString()) : { age: '', unit: 'Years' };

    const [age, setAge] = useState(initialAgeData.age);
    const [ageUnit, setAgeUnit] = useState(initialAgeData.unit);
    const [dob, setDob] = useState(initialData?.dob ? new Date(initialData.dob).toISOString().split('T')[0] : '');
    const [gender, setGender] = useState(initialData?.gender || 'male');
    const [accountingGroup, setAccountingGroup] = useState(
        initialData?.accounting_group ||
        (initialData?.metadata as any)?.accounting_group ||
        'general'
    );


    // Billing Options State
    const checkRegistrationStatus = () => {
        if (!initialData) return { shouldCharge: true, status: 'new' };
        const expiry = initialData.metadata?.registration_expiry;
        if (!expiry) return { shouldCharge: true, status: 'expired' };
        const expiryDate = new Date(expiry);
        const today = new Date();
        if (expiryDate < today) return { shouldCharge: true, status: 'expired' };
        return { shouldCharge: false, status: 'valid', expiryDate };
    };

    const regStatus = checkRegistrationStatus();
    const [chargeRegistration, setChargeRegistration] = useState(hideBilling ? false : regStatus.shouldCharge);
    const [waiveFee, setWaiveFee] = useState(false);


    // Prompt for missing phone
    const [phone, setPhone] = useState(initialData?.contact?.phone || '');
    const [firstName, setFirstName] = useState(initialData?.first_name || '');
    const [lastName, setLastName] = useState(initialData?.last_name || '');
    const [street, setStreet] = useState(initialData?.contact?.address?.street || '');
    const [isListening, setIsListening] = useState(false);


    const handleAgeChange = (value: string, unit: string) => {
        setAge(value);
        setAgeUnit(unit);
        if (value) {
            const currentDate = new Date();
            let years = 0;
            if (unit === 'Years') years = parseInt(value);
            else if (unit === 'Months') years = parseInt(value) / 12;
            else if (unit === 'Days') years = parseInt(value) / 365;

            const birthYear = currentDate.getFullYear() - Math.floor(years);
            const calculatedDob = new Date(birthYear, currentDate.getMonth(), currentDate.getDate());
            setDob(calculatedDob.toISOString().split('T')[0]);
        }
    };

    const handleDobChange = (value: string) => {
        setDob(value);
        if (value) {
            const birthDate = new Date(value);
            const today = new Date();
            let ageYears = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) ageYears--;
            setAge(ageYears.toString());
            setAgeUnit('Years');
        }
    };

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert("Voice input is not supported in this browser.")
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        // [WORLD-CLASS] Intelligent Language Selection: Support en-IN for local clinical context
        recognition.lang = tenantCountry === 'IN' ? 'en-IN' : 'en-US'

        recognition.onstart = () => setIsListening(true)
        recognition.onend = () => setIsListening(false)

        recognition.onerror = (event: any) => {
            console.error("Voice Registry Error:", event.error)
            setIsListening(false)
            
            // Critical Feedback for Non-Secure Contexts (LAN IP Addresses)
            if (event.error === 'not-allowed') {
                alert("Microphone permission was denied. \n\nIMPORTANT: If you are accessing the server via an IP address (e.g. 192.168.x.x), Chrome disables voice features for security. Please use localhost or enable HTTPS.")
            } else if (event.error === 'network') {
                alert("Voice recognition requires an active internet connection to process audio.")
            }
        }

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim()
            console.log("Voice Registry Sync Result:", transcript)

            const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

            // High Precision Name Parsing: "name mahesh theril" | "patient is mahesh" | "identify as mahesh"
            const nameMatch = transcript.match(/(?:name|is|identify as|patient|self)\s+([a-z]+)\s*([a-z]*)/i)
            if (nameMatch) {
                setFirstName(capitalize(nameMatch[1]))
                if (nameMatch[2] && !['years', 'is', 'at'].includes(nameMatch[2].toLowerCase())) {
                    setLastName(capitalize(nameMatch[2]))
                }
            }

            // Age Node Extraction: "age 25" | "he is 25" | "25 years old"
            const ageMatch = transcript.match(/(?:age|is|of)\s+(\d+)/i) || transcript.match(/(\d+)\s*(?:years|yr|age)/i)
            if (ageMatch) {
                const numericAge = ageMatch[1]
                setAge(numericAge)
                setAgeUnit('Years')
                
                // Real-time Ledger Sync for DOB
                const currentDate = new Date()
                const birthYear = currentDate.getFullYear() - parseInt(numericAge)
                const calculatedDob = new Date(birthYear, currentDate.getMonth(), currentDate.getDate())
                setDob(calculatedDob.toISOString().split('T')[0])
            }

            // Geo/Address Node: "place calicut" | "from kondotty" | "at calicut"
            const placeMatch = transcript.match(/(?:place|address|location|at|from|is|live in|lives in)\s+([a-z0-9\s]+)/i)
            if (placeMatch) {
                const p = placeMatch[1].trim()
                if (p && !['mahesh', 'the', 'his', 'her'].includes(p.toLowerCase())) {
                    setStreet(capitalize(p))
                }
            }

            // Communication Node: "mobile 9456..." | "phone 987..." | literal 10-digits
            const mobileMatch = transcript.match(/(?:mobile|phone|number|call|cell)\s*(\d{10})/i)
            if (mobileMatch) {
                setPhone(mobileMatch[1])
            } else {
                const justNum = transcript.match(/(\d{10})/)
                if (justNum) setPhone(justNum[1])
            }
        }

        recognition.start()
    }

    return (
        <div className={isDialog ? "h-full flex flex-col" : "fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-50 p-2"}>
            <div className={`bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 ${isDialog ? 'h-full shadow-none border-none rounded-none' : 'shadow-[0_20px_50px_rgba(8,_112,_184,_0.7)]'}`}>

                {/* Ultra-Modern Header */}
                <div className="px-5 py-3 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10 relative shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-white/10 shrink-0">
                            <User className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                {initialData ? 'Update Profile' : 'New Patient Registration'}
                            </h2>
                            <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {appName?.includes('Ziona') ? "Digital Registry • Powered by Ziona" : `${appName} • Trusted Digital Registry`}
                            </p>
                        </div>
                    </div>
                    {(onClose || !isDialog) && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={startListening}
                                className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                title="Dictate Record (Alt+V)"
                            >
                                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                {isListening ? 'Listening...' : 'Voice Register'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose || (() => router.back())}
                                className="h-10 w-10 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl flex items-center justify-center transition-all active:scale-95"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* iPhone-style Segmented Control */}
                <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex p-1 bg-slate-200/50 dark:bg-slate-800 rounded-xl relative">
                        {[
                            { id: 'basic', label: 'Patient Details', icon: User },
                            { id: 'identity', label: 'Digital Identity & Docs', icon: Shield }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 relative z-10 ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/30'
                                    }`}
                            >
                                <tab.icon className={`h-3 w-3 ${activeTab === tab.id ? 'text-indigo-500' : ''}`} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <form noValidate onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const requiredFields = [
                        { name: 'first_name', tab: 'basic' },
                        { name: 'phone', tab: 'basic' }
                    ];

                    for (const field of requiredFields) {
                        const value = formData.get(field.name);

                        // 1. Check for Empty
                        if (!value || value.toString().trim() === '') {
                            if (activeTab !== field.tab) {
                                setActiveTab(field.tab as any);
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            setMessage({ type: 'error', text: `Missing mandatory field: ${field.name === 'phone' ? 'Mobile Number' : field.name.replace('_', ' ')}` });
                            setTimeout(() => {
                                const element = document.querySelector(`[name="${field.name}"]`) as HTMLElement;
                                element?.focus();
                            }, 150);
                            return;
                        }

                        // 2. Strict Validation: Mobile Number Length
                        if (field.name === 'phone') {
                            const phoneStr = value.toString().trim();
                            // Regex to check if it contains only digits and is exactly 10 long
                            if (!/^\d{10}$/.test(phoneStr)) {
                                if (activeTab !== 'basic') setActiveTab('basic');
                                setMessage({ type: 'error', text: "Mobile number must be exactly 10 digits." });
                                setTimeout(() => {
                                    const element = document.querySelector(`[name="phone"]`) as HTMLElement;
                                    element?.focus();
                                }, 150);
                                return;
                            }
                        }
                    }

                    setIsPending(true);
                    setMessage(null);
                    try {
                        // FORCE Charge Registration Update in FormData if needed
                        if (chargeRegistration) formData.set('charge_registration', 'on');


                        const res = await createPatient(initialData?.id || null, formData);

                        if ((res as any)?.error) {
                            setMessage({ type: 'error', text: (res as any).error });
                        } else {
                            const patient = (res as any).data;
                            const invoiceId = (res as any).invoiceId;

                            // Success BRANCH: Just Save & Close/Print ID
                            setSavedPatient(patient);


                            if (onSuccess) {
                                setIsPending(false);
                                onSuccess(patient);
                                return; // Stop here, parent modal will close
                            }
                            else {
                                setMessage({ type: 'success', text: initialData ? "Profile updated successfully." : "Patient registered successfully." });

                                // REDIRECTION LOGIC: returnPath (from Billing) vs Default
                                if (returnPath) {
                                    setTimeout(() => {
                                        const targetPath = `${returnPath}${returnPath.includes('?') ? '&' : '?'}patientId=${patient.id}${autoSelect ? '&autoSelect=true' : ''}`;
                                        router.push(targetPath);
                                    }, 1000);
                                    return;
                                }

                                // Explicitly check user preference for ID Card
                                if (printIDCard) {
                                    setShowIDCard(true);
                                } else {
                                    // If we are not printing ID card, just close/redirect after a moment
                                    setTimeout(() => {
                                        router.push('/hms/patients');
                                    }, 1000);
                                }
                            }
                        }

                    } catch (err: any) {
                        const errorMsg = err.message || "Unknown Network Error";
                        console.error("Patient Registration Terminal Failure:", err);

                        // Force alert for user awareness
                        alert(`PATIENT REGISTRATION FAILED: ${errorMsg}\n\nPlease check your internet and DB status.`);

                        setMessage({ type: 'error', text: `Registration Interrupted: ${errorMsg}` });
                    } finally {
                        setIsPending(false);
                    }
                }} id="patient-master-form" className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-950 relative">

                    <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-indigo-100 dark:scrollbar-thumb-slate-800">
                        {message && (
                            <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-4 shadow-lg ${message.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-gradient-to-r from-rose-500 to-red-500 text-white'}`}>
                                <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                    {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                </div>
                                <span className="font-bold text-xs tracking-wide">{message.text}</span>
                            </div>
                        )}

                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                            {/* TAB 1: BASIC DETAILS (Personal + Contact + Location) */}
                            <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                    {/* COLUMN 1: Personal & Vitals */}
                                    <div className="lg:col-span-7 space-y-4">
                                        {/* Personal Identity */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <User className="h-4 w-4" /> Personal Details
                                            </h3>
                                            <div className="grid grid-cols-12 gap-3">
                                                <div className="col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Title</label>
                                                    <div className="relative">
                                                        <select autoFocus defaultValue={initialData?.metadata?.title} name="title" className="w-full h-10 px-3 bg-white dark:bg-slate-800 border items-center border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                                                            <option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option><option>Baby</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                                    </div>
                                                </div>
                                                <div className="col-span-9 grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">First Name</label>
                                                        <input value={firstName} onChange={(e) => setFirstName(e.target.value.replace(/\b\w/g, c => c.toUpperCase()))} name="first_name" type="text" placeholder="First Name" required className="w-full h-10 px-3 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Last Name</label>
                                                        <input value={lastName} onChange={(e) => setLastName(e.target.value.replace(/\b\w/g, c => c.toUpperCase()))} name="last_name" type="text" placeholder="Last Name" className="w-full h-10 px-3 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Vitals */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Activity className="h-4 w-4" /> Vitals & Demographics
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Gender</label>
                                                    <div className="flex gap-2">
                                                        {['male', 'female', 'other'].map(g => (
                                                            <button key={g} type="button" onClick={() => setGender(g)} className={`flex-1 h-10 rounded-lg border font-bold uppercase text-[10px] transition-all ${gender === g ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                                                                {g}
                                                            </button>
                                                        ))}
                                                        <input type="hidden" name="gender" value={gender} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Blood Group</label>
                                                    <div className="relative">
                                                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400" />
                                                        <select defaultValue={initialData?.blood_group || initialData?.metadata?.blood_group} name="blood_group" className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                                                            <option value="">Select Group</option>
                                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* WORLD-STANDARD ACCOUNTING GROUP */}
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Patient Billing Category</label>
                                                <div className="flex gap-2">
                                                    {[
                                                        { id: 'general', label: 'General / Self-Pay', color: 'indigo' },
                                                        { id: 'insurance', label: 'Insurance (TPA)', color: 'emerald' },
                                                        { id: 'corporate', label: 'Corporate (Credit)', color: 'orange' }
                                                    ].map(group => (
                                                        <button
                                                            key={group.id}
                                                            type="button"
                                                            onClick={() => setAccountingGroup(group.id)}
                                                            className={`flex-1 h-10 rounded-lg border font-bold uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${accountingGroup === group.id
                                                                ? `border-${group.color}-500 bg-${group.color}-50 text-${group.color}-600`
                                                                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full bg-${group.color}-500`}></div>
                                                            {group.label}
                                                        </button>
                                                    ))}
                                                    <input type="hidden" name="accounting_group" value={accountingGroup} />
                                                </div>
                                                <p className="mt-1 text-[9px] text-slate-400 font-medium italic">
                                                    * This determines how the patient's future invoices will be processed and routed.
                                                </p>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-12 gap-3">
                                                <div className="col-span-2 md:col-span-5">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Date of Birth</label>
                                                    <input name="dob" type="date" value={dob} onChange={(e) => handleDobChange(e.target.value)} className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 text-sm outline-none focus:border-indigo-500" />
                                                </div>
                                                <div className="col-span-2 md:col-span-2 flex items-center justify-center pt-2 md:pt-4">
                                                    <span className="text-[10px] font-bold text-slate-300">OR</span>
                                                </div>
                                                <div className="col-span-1 md:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Age</label>
                                                    <input type="number" value={age} onChange={(e) => handleAgeChange(e.target.value, ageUnit)} className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 rounded-lg font-black text-emerald-600 outline-none focus:border-emerald-500" placeholder="0" />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">Unit</label>
                                                    <select value={ageUnit} onChange={(e) => handleAgeChange(age, e.target.value)} className="w-full h-10 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs outline-none focus:border-indigo-500">
                                                        <option>Years</option><option>Months</option><option>Days</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COLUMN 2: Contact & Address */}
                                    <div className="lg:col-span-5 space-y-4">
                                        <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                    <Phone className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Contact & Location</h3>
                                                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Communication</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Mobile Number <span className="text-rose-500">*</span></label>
                                                    <div className="relative group">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                        <input
                                                            value={phone}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                                setPhone(val);
                                                            }}
                                                            name="phone"
                                                            type="tel"
                                                            placeholder="e.g. 9876543210"
                                                            required
                                                            className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all text-sm tracking-wide"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Email Address</label>
                                                    <div className="relative group">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                        <input defaultValue={initialData?.contact?.email} name="email" type="email" placeholder="email@example.com" className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all text-sm" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Address</label>
                                                    <textarea value={street} onChange={(e) => setStreet(e.target.value)} name="street" placeholder="Street Address, Area" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-xs outline-none focus:border-indigo-500 transition-all min-h-[50px] resize-none" />
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <input defaultValue={initialData?.contact?.address?.city} name="city" type="text" placeholder="City" className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-xs" />
                                                        <input defaultValue={initialData?.contact?.address?.zip} name="zip" type="text" placeholder="Pincode" className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-xs" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TAB 2: DIGITAL IDENTITY (Photo + ID Proof) */}
                            <div className={activeTab === 'identity' ? 'block' : 'hidden'}>
                                <div className="max-w-3xl mx-auto space-y-6 py-6">
                                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-40 bg-indigo-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>

                                        <div className="flex items-center gap-4 mb-6 relative z-10">
                                            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                                <Shield className="h-7 w-7 text-indigo-300" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-white tracking-tight">Digital Vault</h3>
                                                <p className="text-indigo-200 text-xs font-medium">Secure storage for patient identity and documents.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors">
                                                <label className="block text-xs font-bold text-indigo-200 mb-2 uppercase tracking-wide">Patient Photo</label>
                                                <FileUpload onUploadComplete={(url) => setProfileImageUrl(url)} folder="patients/profiles" label="Capture / Upload Photo" accept="image/*" showCamera={true} compact={false} />
                                                <input type="hidden" name="profile_image_url" value={profileImageUrl} />
                                            </div>
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors">
                                                <label className="block text-xs font-bold text-indigo-200 mb-2 uppercase tracking-wide">Government ID Proof</label>
                                                <FileUpload onUploadComplete={(url) => setIdCardUrl(url)} folder="patients/ids" label="Upload ID Document" accept="application/pdf,image/*" compact={false} />
                                                <input type="hidden" name="id_card_url" value={idCardUrl} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 flex gap-3 items-start">
                                        <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wide mb-1">Privacy Notice</h4>
                                            <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                                                Documents uploaded here are encrypted at rest. Access is restricted to authorized clinical and administrative staff only.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Premium Footer */}
                    <div className="px-5 py-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] shrink-0">
                        <div className="flex items-center gap-6">
                            {/* ID Card Checkbox */}
                            {enableCardIssuanceSetting && (
                                <label className="group flex items-center gap-3 cursor-pointer p-1 px-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={printIDCard}
                                            onChange={(e) => setPrintIDCard(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider group-hover:text-indigo-600 transition-colors">
                                            Print ID Card
                                        </span>
                                        <span className="block text-[10px] font-bold text-slate-400">
                                            Show QR Code & Details
                                        </span>
                                    </div>
                                </label>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => onClose ? onClose() : router.back()}
                                className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 hover:border-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPending ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                {initialData ? 'Update Profile' : 'Save Patient'}
                            </button>
                        </div>
                    </div>
                </form>
            </div >



            {
                showIDCard && savedPatient && (
                    <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl p-8 rounded-3xl shadow-2xl border border-white/20 animate-in zoom-in-95">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Patient ID Card</h3>
                                <button
                                    onClick={() => setShowIDCard(false)}
                                    className="h-10 w-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <PatientIDCard
                                patient={savedPatient}
                                registrationFee={registrationFee}
                                upiId="hospital@upi"
                            />
                            <div className="mt-6 flex gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        setShowIDCard(false);
                                        if (onSuccess) onSuccess(savedPatient);
                                        else if (returnPath) {
                                            const finalUrl = `${returnPath}${returnPath.includes('?') ? '&' : '?'}patientId=${savedPatient.id}${autoSelect ? '&autoSelect=true' : ''}`;
                                            router.push(finalUrl);
                                        }
                                        else router.push('/hms/patients');
                                    }}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >

    );
}
