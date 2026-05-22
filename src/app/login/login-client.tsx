'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Building2, Activity } from "lucide-react"
import { motion } from "framer-motion"
import { ZionaLogo } from "@/components/branding/ziona-logo"

interface Branding {
    app_name: string | null;
    logo_url: string | null;
    name: string | null;
    isPublic: boolean;
}

export default function LoginClient({ branding }: { branding: Branding | null }) {
    const [isLoading, setIsLoading] = useState(false)
    const [focusedField, setFocusedField] = useState<string | null>(null)

    // Form State for Login
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    })

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setIsLoading(true)
        try {
            const result = await signIn("credentials", {
                email: formData.email,
                password: formData.password,
                redirect: false,
            })

            console.log("Login Result:", result);

            if (result?.error) {
                let errorMessage = "Invalid email or password. Please try again.";
                if (result.error !== "CredentialsSignin") {
                    errorMessage = result.error;
                }
                alert("Login Failed: " + errorMessage);
                setIsLoading(false)
            } else {
                // Successful login
                window.location.href = "/";
            }
        } catch (error) {
            console.error(error)
            alert("An unexpected error occurred: " + JSON.stringify(error));
            setIsLoading(false)
        }
    }

    const appName = branding?.app_name || "Enterprise ERP";
    const isCRM = appName.toLowerCase().includes('crm');

    const theme = isCRM ? {
        // Updated to Green/Emerald Theme for Seeakk CRM
        bgImage: "/crm-green-bg.png",
        gradientOverlay: "from-emerald-950/90 via-gray-950/70 to-teal-950/50",
        radialOverlay: "from-emerald-900/30 via-slate-950/50 to-black/80",
        heading: (
            <>
                Powering <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
                    Business Growth
                </span>
            </>
        ),
        subheading: "Manage leads, track performance, and drive revenue with AI-driven insights.",
        tagline: "Intelligent Business Suite"
    } : {
        bgImage: "/login-bg.png",
        gradientOverlay: "from-slate-950/80 via-slate-900/60 to-slate-900/40",
        radialOverlay: "from-indigo-950/20 via-slate-950/40 to-slate-950/80",
        heading: (
            <>
                The Future of <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-400 to-indigo-400">
                    Healthcare
                </span>
            </>
        ),
        subheading: "Streamline patient care, manage operations efficiently, and experience the next generation of hospital management.",
        tagline: "Secure Enterprise Gateway"
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center font-sans overflow-hidden relative">

            {/* Cinematic Background (Fixed Full Screen) */}
            <div className="absolute inset-0 bg-slate-900">
                <motion.div
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 2.5, ease: "easeOut" }}
                    className="absolute inset-0"
                >
                    <img
                        src={theme.bgImage}
                        alt="Background"
                        className="w-full h-full object-cover opacity-80"
                    />
                    {/* Gradient Overlays for Readability */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradientOverlay}`} />
                    <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${theme.radialOverlay}`} />
                </motion.div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto p-4 flex flex-col items-center justify-center">

                <motion.div
                    initial={{ y: 30 }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full max-w-md"
                >
                    {/* Glassmorphism Card */}
                    <div className="backdrop-blur-xl bg-white/10 dark:bg-black/40 border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] rounded-3xl overflow-hidden relative">
                        {/* Glow Effect Top */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-[80px]" />
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-[80px]" />

                        <div className="p-8 md:p-10 relative z-10">

                            {/* Header Section */}
                            <div className="text-center mb-10">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex justify-center mb-6"
                                >
                                    {appName.toLowerCase().includes('ziona') ||
                                        appName.toLowerCase().includes('cloud hms') ||
                                        process.env.NEXT_PUBLIC_APP_BRAND === 'ZIONA' ? (
                                        <div className="relative group">
                                            {/* Advanced Glow */}
                                            <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-1000" />
                                            <ZionaLogo size={120} colorScheme="signature" theme="dark" variant="icon" speed="slow" />
                                        </div>
                                    ) : (
                                        <div className="w-32 h-32 relative flex items-center justify-center">
                                            {/* Glows for context */}
                                            <div className="absolute inset-0 bg-blue-500/10 blur-[40px] rounded-full" />

                                            {/* Stylized Logo Container */}
                                            <div className="relative z-10 w-28 h-28 bg-white rounded-2xl p-4 shadow-2xl flex items-center justify-center border border-white/20">
                                                {branding?.logo_url ? (
                                                    <img src={branding.logo_url}
                                                        alt={appName}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <Activity className="w-12 h-12 text-blue-600" />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <h1 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r tracking-tighter mb-3 filter contrast-125 ${isCRM
                                        ? "from-emerald-400 via-teal-400 to-cyan-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        : "from-cyan-400 via-purple-500 to-emerald-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                                        }`}>
                                        {appName}
                                    </h1>
                                    <div className={`h-0.5 w-16 bg-gradient-to-r from-transparent to-transparent mx-auto mb-4 opacity-70 ${isCRM
                                        ? "via-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                                        : "via-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                                        }`} />
                                    <p className="text-slate-400 text-xs font-semibold tracking-[0.3em] uppercase opacity-70">
                                        {theme.tagline}
                                    </p>
                                </motion.div>
                            </div>

                            {/* Login Form */}
                            <form onSubmit={handleLogin} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300 ml-1 uppercase tracking-wider">Email</label>
                                    <div className={`relative group transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className={`h-5 w-5 transition-colors duration-300 ${focusedField === 'email' ? 'text-cyan-400' : 'text-slate-500'}`} />
                                        </div>
                                        <input
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            className="block w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-black/40 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300 backdrop-blur-sm"
                                            placeholder="doctor@hospital.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                                        <a href="#" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">Forgot?</a>
                                    </div>
                                    <div className={`relative group transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className={`h-5 w-5 transition-colors duration-300 ${focusedField === 'password' ? 'text-cyan-400' : 'text-slate-500'}`} />
                                        </div>
                                        <input
                                            name="password"
                                            type="password"
                                            value={formData.password}
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            className="block w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-black/40 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300 backdrop-blur-sm"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white py-4 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-cyan-900/40 hover:shadow-cyan-500/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-300 mt-2 disabled:opacity-70 disabled:cursor-not-allowed group flex items-center justify-center gap-2 relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                                            <span className="relative z-10">Authenticating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="relative z-10">Sign In to Dashboard</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer in Card */}
                        <div className="px-8 pb-6 text-center">
                            <p className="text-xs text-slate-500">
                                Protected by Enterprise Security &copy; {new Date().getFullYear()}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
