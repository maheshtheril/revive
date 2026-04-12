'use client'

import { useActionState, useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { signup } from "@/app/actions/auth"
import { getCountries, getCurrencies, getModules } from "@/app/actions/public"
import { Check, ChevronRight, Building, Layers } from "lucide-react"
import { ZionaLogo } from "@/components/branding/ziona-logo"

export function SignupForm({ setIsLogin, branding }: { setIsLogin?: (v: boolean) => void, branding?: any }) {
    const [step, setStep] = useState(1)
    const [state, formAction, isPending] = useActionState(signup, null)
    const [signingIn, setSigningIn] = useState(false)

    // Data constraints
    const [countries, setCountries] = useState<any[]>([])
    const [currencies, setCurrencies] = useState<any[]>([])
    const [modules, setModules] = useState<any[]>([])

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        companyName: '',
        countryId: '',
        currencyId: '',
        industry: '',
        modules: [] as string[]
    })

    useEffect(() => {
        console.log("[SIGNUP] Initiating data load...");
        getCountries().then(data => {
            console.log("[SIGNUP] Countries received:", data?.length || 0);
            setCountries(data || []);
        });
        getCurrencies().then(data => {
            console.log("[SIGNUP] Currencies received:", data?.length || 0);
            setCurrencies(data || []);
        });
        getModules().then(data => {
            console.log("[SIGNUP] Modules received:", data?.length || 0);
            setModules(data || []);
        });
    }, [])

    const nextStep = () => {
        const form = document.getElementById('signup-form') as HTMLFormElement;
        if (form && !form.checkValidity()) {
            form.reportValidity();
            return;
        }
        setStep(s => s + 1)
    }
    const prevStep = () => setStep(s => s - 1)

    const toggleModule = (key: string) => {
        setFormData(prev => ({
            ...prev,
            modules: prev.modules.includes(key)
                ? prev.modules.filter(m => m !== key)
                : [...prev.modules, key]
        }))
    }

    // Auto-login on success
    useEffect(() => {
        if (state && !('error' in state) && formData.email && formData.password && !signingIn) {
            setSigningIn(true);
            let callbackUrl = "/";
            if (formData.modules.includes('crm') && !formData.modules.includes('hms')) {
                callbackUrl = "/crm/dashboard";
            } else if (formData.modules.includes('hms')) {
                callbackUrl = "/hms/dashboard";
            }

            signIn("credentials", {
                email: formData.email.toLowerCase(),
                password: formData.password,
                redirect: false
            }).then(result => {
                if (result?.error) {
                    console.error("[AUTH] Auto-login failed:", result.error);
                    // Force a reload to the login page with the error if it failed
                    window.location.href = `/login?error=CredentialsSignin&email=${encodeURIComponent(formData.email)}`;
                } else {
                    window.location.href = callbackUrl;
                }
            }).catch(err => {
                console.error("[AUTH] Fatal auto-login error:", err);
                setSigningIn(false);
            });
        }
    }, [state, formData.email, formData.password, formData.modules, signingIn]);

    // Auto-select currency based on country
    useEffect(() => {
        if (formData.countryId && currencies.length > 0) {
            const country = countries.find(c => c.id === formData.countryId);
            if (country) {
                if (country.iso2 === 'IN') {
                    const inr = currencies.find(c => c.code === 'INR');
                    if (inr) setFormData(p => ({ ...p, currencyId: inr.id }))
                } else if (country.iso2 === 'US') {
                    const usd = currencies.find(c => c.code === 'USD');
                    if (usd) setFormData(p => ({ ...p, currencyId: usd.id }))
                }
            }
        }
    }, [formData.countryId, currencies, countries])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]">

                {/* Sidebar Progress */}
                <div className="bg-slate-900 p-8 md:w-1/3 flex flex-col justify-between text-white">
                    <div>
                        <div className="bg-black w-14 h-14 rounded-xl flex items-center justify-center mb-6 overflow-hidden shadow-2xl shadow-indigo-500/20 border border-white/10 shrink-0">
                            {branding?.logo_url ? (
                                <img src={branding.logo_url} alt={branding.app_name || 'Logo'} className="h-full w-full object-contain p-2" />
                            ) : (
                                <ZionaLogo size={36} variant="icon" theme="dark" speed="slow" colorScheme="signature" />
                            )}
                        </div>
                        <h2 className="text-xl font-bold mb-2">Join {branding?.app_name || branding?.name || 'Organization'}</h2>
                        <p className="text-slate-400 text-sm">Create your world-class workspace in minutes.</p>
                    </div>

                    <div className="space-y-6">
                        <div className={`flex item-center gap-3 ${step >= 1 ? 'text-blue-400' : 'text-slate-600'}`}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${step >= 1 ? 'border-blue-400 bg-blue-400/10' : 'border-slate-600'}`}>1</div>
                            <span className="text-sm font-medium">Account Details</span>
                        </div>
                        <div className={`flex item-center gap-3 ${step >= 2 ? 'text-blue-400' : 'text-slate-600'}`}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${step >= 2 ? 'border-blue-400 bg-blue-400/10' : 'border-slate-600'}`}>2</div>
                            <span className="text-sm font-medium">Organization</span>
                        </div>
                        <div className={`flex item-center gap-3 ${step >= 3 ? 'text-blue-400' : 'text-slate-600'}`}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${step >= 3 ? 'border-blue-400 bg-blue-400/10' : 'border-slate-600'}`}>3</div>
                            <span className="text-sm font-medium">Preferences</span>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500">
                        © {new Date().getFullYear()} Enterprise
                    </div>
                </div>

                {/* Form Area */}
                <div className="p-8 flex-1 bg-white dark:bg-slate-950 relative">
                    <form id="signup-form" action={formAction} className="h-full flex flex-col">
                        <input type="hidden" name="email" value={formData.email} />
                        <input type="hidden" name="password" value={formData.password} />
                        <input type="hidden" name="name" value={formData.name} />
                        <input type="hidden" name="companyName" value={formData.companyName} />
                        <input type="hidden" name="countryId" value={formData.countryId} />
                        <input type="hidden" name="currencyId" value={formData.currencyId} />
                        <input type="hidden" name="industry" value={formData.industry} />
                        <input type="hidden" name="modules" value={formData.modules.join(',')} />

                        {step === 1 && (
                            <div className="flex-1 space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">You Details</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Full Name</label>
                                    <input value={formData.name} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="Enter your full name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Work Email</label>
                                    <input type="email" value={formData.email} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="name@company.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Password</label>
                                    <input type="password" value={formData.password} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={e => setFormData({ ...formData, password: e.target.value })} required className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="Min. 8 characters" />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex-1 space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Profile</h3>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Company Name</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                        <input value={formData.companyName} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={e => setFormData({ ...formData, companyName: e.target.value })} required className="w-full border border-gray-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="My Organization Ltd." />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Country</label>
                                        <select
                                            value={formData.countryId}
                                            onChange={e => setFormData({ ...formData, countryId: e.target.value })}
                                            required
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                            className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                        >
                                            <option value="">Select Country</option>
                                            {countries.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Currency</label>
                                        <select
                                            value={formData.currencyId}
                                            onChange={e => setFormData({ ...formData, currencyId: e.target.value })}
                                            required
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                            className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                        >
                                            <option value="">Select Currency</option>
                                            {currencies.map(c => (
                                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Industry</label>
                                    <select value={formData.industry} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={(e) => {
                                        const val = e.target.value;
                                        // RESET modules to ensure clean slate for the new industry
                                        let newModules: string[] = [];

                                        // SMART DEFAULTS (World Class)
                                        if (val === 'Healthcare') {
                                            newModules = ['hms', 'inventory', 'finance'];
                                        } else if (val === 'Retail' || val === 'Manufacturing') {
                                            newModules = ['inventory', 'finance', 'crm'];
                                        } else if (val === 'Services') {
                                            newModules = ['crm', 'finance'];
                                        }

                                        setFormData({ ...formData, industry: val, modules: newModules });
                                    }} className="w-full border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                                        <option value="">Select Industry...</option>
                                        <option value="Healthcare">Healthcare / Hospital</option>
                                        <option value="Manufacturing">Manufacturing</option>
                                        <option value="Retail">Retail / Pharmacy</option>
                                        <option value="Services">Professional Services</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex-1 space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Module Selection</h3>
                                <p className="text-sm text-gray-500 mb-4">Select the modules relevant to your business.</p>

                                {/* Selected Summary Chips (Always Visible) */}
                                {formData.modules.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                                        {formData.modules.map(key => {
                                            const mod = modules.find(m => m.module_key === key);
                                            return (
                                                <span key={key} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> {mod?.name || key.toUpperCase()}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {modules.filter(m => !['reports', 'system'].includes(m.module_key.toLowerCase())).map(mod => (
                                        <div
                                            key={mod.module_key}
                                            onClick={() => toggleModule(mod.module_key)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all ${formData.modules.includes(mod.module_key) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.modules.includes(mod.module_key) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                                    {formData.modules.includes(mod.module_key) && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{mod.name}</h4>
                                                    <p className="text-xs text-gray-500">{mod.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        )}

                        {/* Error/Success Messages */}
                        {step === 3 && state && 'error' in state && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mt-2">{state.error}</div>
                        )}
                        {step === 3 && state && !('error' in state) && (
                            <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm mt-2">
                                Account created successfully! Finalizing your setup...
                            </div>
                        )}


                        {/* Footer Buttons */}
                        <div className="mt-auto pt-6 border-t border-gray-100 flex justify-between">
                            {step > 1 ? (
                                <button type="button" onClick={prevStep} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                                    Back
                                </button>
                            ) : (
                                <div />
                            )}

                            {step < 3 ? (
                                <button type="button" onClick={nextStep} className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                                    Next Step <ChevronRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <div className="flex flex-col items-end gap-2">
                                    <button
                                        type="submit"
                                        disabled={isPending || formData.modules.length === 0}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none"
                                    >
                                        {isPending ? 'Creating Account...' : 'Complete Setup'}
                                    </button>
                                    {formData.modules.length === 0 && (
                                        <span className="text-xs text-red-500 font-medium animate-pulse">Select a module to continue</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
