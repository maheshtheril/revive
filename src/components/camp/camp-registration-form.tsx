'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { registerCampPatient } from '@/app/actions/camp-registration'
import { toast } from 'sonner'
import { User, Phone, Mail, Calendar, Droplet, UserCheck, ArrowRight, ArrowLeft, Loader2, Heart, CheckCircle2 } from 'lucide-react'

export default function CampRegistrationForm() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [completed, setCompleted] = useState(false)
    const [registeredId, setRegisteredId] = useState('')
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dob: '',
        gender: '',
        phone: '',
        email: '',
        bloodGroup: ''
    })

    const [errors, setErrors] = useState<{ [key: string]: string }>({})

    const validateStep1 = () => {
        const newErrors: { [key: string]: string } = {}
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const validateStep2 = () => {
        const newErrors: { [key: string]: string } = {}
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required'
        } else if (!/^\+?[\d\s-]{10,15}$/.test(formData.phone.trim())) {
            newErrors.phone = 'Enter a valid phone number (min 10 digits)'
        }
        
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            newErrors.email = 'Enter a valid email address'
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleNext = () => {
        if (step === 1) {
            if (validateStep1()) {
                setStep(2)
            }
        }
    }

    const handleBack = () => {
        setStep(1)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateStep2()) return

        setLoading(true)
        try {
            const res = await registerCampPatient({
                firstName: formData.firstName,
                lastName: formData.lastName,
                dob: formData.dob || undefined,
                gender: formData.gender || undefined,
                phone: formData.phone,
                email: formData.email || undefined,
                bloodGroup: formData.bloodGroup || undefined,
            })

            if (res.success) {
                setCompleted(true)
                setRegisteredId(res.patientId || '')
                toast.success('Registration completed successfully!')
            } else {
                toast.error(res.error || 'Failed to submit registration. Please try again.')
            }
        } catch (err: any) {
            console.error(err)
            toast.error('An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.6, ease: 'easeOut' }
        },
        exit: { opacity: 0, y: -30, transition: { duration: 0.3 } }
    }

    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 150 : -150,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1,
            transition: { duration: 0.4, ease: 'easeOut' }
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 150 : -150,
            opacity: 0,
            transition: { duration: 0.3 }
        })
    } as any

    if (completed) {
        return (
            <motion.div 
                className="w-full max-w-lg p-8 rounded-3xl glass shadow-2xl relative overflow-hidden text-center flex flex-col items-center justify-center border border-white/20 dark:border-white/10"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Floating animated particles in card background */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-teal-500/5 to-transparent -z-10 pointer-events-none" />
                
                <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                    className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 border border-emerald-500/30"
                >
                    <CheckCircle2 size={50} className="stroke-[1.5]" />
                </motion.div>

                <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-green-400 bg-clip-text text-transparent mb-3">
                    Registration Success!
                </h2>
                
                <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-sm">
                    Thank you, <span className="font-semibold text-slate-900 dark:text-white">{formData.firstName}</span>. Your details have been submitted to the cloud staging server.
                </p>

                <div className="w-full p-6 bg-slate-900/40 dark:bg-black/40 rounded-2xl border border-white/5 mb-8 text-left space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                        <span className="text-slate-400">Temporary ID</span>
                        <span className="font-mono text-xs font-semibold text-teal-400">{registeredId.substring(0, 8).toUpperCase()}...</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Patient Name</span>
                        <span className="font-medium text-slate-200">{formData.firstName} {formData.lastName}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Phone Number</span>
                        <span className="font-medium text-slate-200">{formData.phone}</span>
                    </div>
                    {formData.bloodGroup && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Blood Group</span>
                            <span className="font-semibold text-rose-400">{formData.bloodGroup}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4 w-full">
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <Heart size={12} className="text-rose-500 fill-rose-500 animate-pulse" />
                        Please present your registered phone number at the camp counter to pull your clinical record.
                    </p>
                    <button
                        onClick={() => {
                            setFormData({
                                firstName: '',
                                lastName: '',
                                dob: '',
                                gender: '',
                                phone: '',
                                email: '',
                                bloodGroup: ''
                            })
                            setStep(1)
                            setCompleted(false)
                        }}
                        className="w-full py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                    >
                        Register Another Patient
                    </button>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            className="w-full max-w-lg p-8 rounded-3xl glass shadow-2xl relative overflow-hidden border border-white/20 dark:border-white/10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent -z-10 pointer-events-none" />
            
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-3">
                    <Heart size={12} className="text-rose-500 fill-rose-500" />
                    Medical Camp Portal
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Patient Registration
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Enter your details to register quickly.
                </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
                <div className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? 'w-10 bg-primary' : 'w-2 bg-slate-300 dark:bg-slate-700'}`} />
                <div className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? 'w-10 bg-primary' : 'w-2 bg-slate-300 dark:bg-slate-700'}`} />
            </div>

            <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
                <div className="min-h-[280px] relative overflow-hidden">
                    <AnimatePresence mode="wait" custom={step === 2 ? 1 : -1}>
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                custom={1}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="space-y-4"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">First Name *</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></span>
                                            <input
                                                type="text"
                                                required
                                                placeholder="John"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 transition-all ${
                                                    errors.firstName ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-700 focus:ring-primary/20 focus:border-primary'
                                                }`}
                                            />
                                        </div>
                                        {errors.firstName && <p className="text-xs text-rose-500 font-medium">{errors.firstName}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Last Name</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></span>
                                            <input
                                                type="text"
                                                placeholder="Doe"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Date of Birth</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Calendar size={16} /></span>
                                        <input
                                            type="date"
                                            value={formData.dob}
                                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Gender</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Male', 'Female', 'Other'].map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, gender: g })}
                                                className={`py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                                                    formData.gender === g
                                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                        : 'border-slate-700 bg-slate-950/20 dark:bg-black/30 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                custom={-1}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number *</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></span>
                                        <input
                                            type="tel"
                                            required
                                            placeholder="9876543210"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 transition-all ${
                                                errors.phone ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-700 focus:ring-primary/20 focus:border-primary'
                                            }`}
                                        />
                                    </div>
                                    {errors.phone && <p className="text-xs text-rose-500 font-medium">{errors.phone}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={16} /></span>
                                        <input
                                            type="email"
                                            placeholder="john.doe@example.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 transition-all ${
                                                errors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-700 focus:ring-primary/20 focus:border-primary'
                                            }`}
                                        />
                                    </div>
                                    {errors.email && <p className="text-xs text-rose-500 font-medium">{errors.email}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Blood Group</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Droplet size={16} /></span>
                                        <select
                                            value={formData.bloodGroup}
                                            onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950/20 dark:bg-black/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer text-slate-300"
                                        >
                                            <option value="" disabled className="bg-slate-900 text-slate-400">Select Blood Group</option>
                                            <option value="A+" className="bg-slate-900">A+</option>
                                            <option value="A-" className="bg-slate-900">A-</option>
                                            <option value="B+" className="bg-slate-900">B+</option>
                                            <option value="B-" className="bg-slate-900">B-</option>
                                            <option value="AB+" className="bg-slate-900">AB+</option>
                                            <option value="AB-" className="bg-slate-900">AB-</option>
                                            <option value="O+" className="bg-slate-900">O+</option>
                                            <option value="O-" className="bg-slate-900">O-</option>
                                        </select>
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 border-l border-slate-700 pl-3 pointer-events-none text-slate-400">▼</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="flex gap-4 pt-4 border-t border-white/10">
                    {step === 2 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={loading}
                            className="flex-1 py-3 px-6 rounded-xl font-semibold border border-slate-700 bg-slate-950/20 hover:bg-slate-900 text-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                    )}

                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="flex-1 py-3 px-6 rounded-xl font-semibold bg-primary hover:bg-primary-hover text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] cursor-pointer"
                        >
                            Next Step
                            <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent hover:from-primary hover:to-accent text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <UserCheck size={16} />
                                    Complete Register
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>
        </motion.div>
    )
}
