'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '@/app/actions/users'
import { Shield, Key, Lock, Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AcceptInviteForm({ token, email }: { token: string, email: string }) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (password !== confirm) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)
        const result = await acceptInvitation(token, password)

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            router.push('/login?message=Account set up successfully. Please log in.')
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background Blobs */}
            <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 -right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="w-full max-w-md relative">
                {/* Logo/Brand Area */}
                <div className="text-center mb-8">
                    <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/20 mb-4">
                        <Shield className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Identity Activation</h1>
                    <p className="text-slate-400 mt-2">Set credentials for <span className="text-indigo-400 font-medium">{email}</span></p>
                </div>

                <Card className="glass-card bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden border">
                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-300 ml-1">Secure Password</label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min 8 characters..."
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-300 ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Repeat password..."
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className="pl-10 h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Strength Indicator */}
                            {password && (
                                <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <span>Security Level</span>
                                        <span className={password.length >= 12 ? "text-emerald-400" : password.length >= 8 ? "text-indigo-400" : "text-amber-400"}>
                                            {password.length >= 12 ? 'Excellent' : password.length >= 8 ? 'Good' : 'Weak'}
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${password.length >= 12 ? 'w-full bg-emerald-500' :
                                                password.length >= 8 ? 'w-2/3 bg-indigo-500' : 'w-1/3 bg-amber-500'
                                                }`}
                                        />
                                    </div>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Activating Account...
                                    </span>
                                ) : (
                                    "Initialize Access"
                                )}
                            </Button>
                        </form>
                    </div>
                </Card>

                <p className="text-center text-slate-500 text-[10px] mt-8 uppercase tracking-[0.2em] font-medium">
                    Secure Enterprise Channel • Operations
                </p>
            </div>
        </div>
    )
}
