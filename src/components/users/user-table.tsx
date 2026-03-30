'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Filter, Edit, Power, Trash2, Mail, Shield, CheckCircle, XCircle, Check, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateUserStatus, deleteUser, deleteUserPermanently, resendInvitation } from '@/app/actions/users'
import { useToast } from '@/components/ui/use-toast'
import { cn, copyToClipboard } from '@/lib/utils'
import Link from 'next/link'

interface User {
    id: string
    email: string
    full_name: string | null
    name: string | null
    role: string | null
    is_active: boolean | null
    created_at: Date | null
    hms_user_roles?: Array<{
        id?: string
        hms_role: {
            id: string
            name: string
        }
    }>
    mobile?: string | null
    country?: { name: string, flag: string } | null
    subdivision?: { name: string, type: string } | null
    country_subdivision?: { name: string, type: string } | null
}

interface UserTableProps {
    users: User[]
    total: number
    pages: number
    currentPage: number
}

export function UserTable({ users, total, pages, currentPage }: UserTableProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    const handleSearch = () => {
        const params = new URLSearchParams()
        if (searchQuery) params.set('search', searchQuery)
        if (roleFilter !== 'all') params.set('role', roleFilter)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        router.push(`/settings/users?${params.toString()}`)
    }

    const handleResendInvite = async (userId: string) => {
        const result = await resendInvitation(userId)

        if (result.error) {
            toast({
                title: 'Operation Failed',
                description: result.error,
                variant: 'destructive',
                className: "bg-red-500 text-white border-none shadow-2xl"
            })
        } else {
            const isEmailFailed = result.emailStatus === 'failed'

            toast({
                title: isEmailFailed ? 'Email Service Configuration Required' : 'Invitation Dispatches',
                className: isEmailFailed ? 'border-indigo-500 bg-slate-900 text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)]' : 'bg-indigo-600 text-white border-none shadow-2xl',
                description: (
                    <div className="flex flex-col gap-4 mt-3">
                        <p className="font-bold text-sm leading-tight">{result.message}</p>
                        {result.inviteLink && (
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Manual Activation Link</p>
                                <button
                                    onClick={() => {
                                        const success = copyToClipboard(result.inviteLink!)
                                        if (success) toast({ title: "Copied!", variant: "default", className: "bg-emerald-600 text-white" })
                                    }}
                                    className="w-full bg-white/20 hover:bg-white hover:text-indigo-600 p-2 rounded-lg text-white text-left font-bold text-[10px] flex items-center justify-between transition-all group"
                                >
                                    <span>Copy Link</span>
                                    <Check className="h-3 w-3 group-hover:scale-125 transition-transform" />
                                </button>
                            </div>
                        )}
                    </div>
                ),
                duration: 15000,
            })
            router.refresh()
        }
    }

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        const result = await updateUserStatus(userId, !currentStatus)
        if (result.error) {
            toast({
                title: 'Status Update Denied',
                description: result.error,
                variant: 'destructive'
            })
        } else {
            toast({
                title: 'User Updated',
                description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
                className: "bg-indigo-600 text-white border-none shadow-xl"
            })
            router.refresh()
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you certain you want to SUSPEND this user? They will still remain in the database but cannot login.')) return

        const result = await deleteUser(userId)
        if (result.error) {
            toast({
                title: 'Error Rendering Command',
                description: result.error,
                variant: 'destructive'
            })
        } else {
            toast({
                title: 'User Suspended',
                description: result.message || 'User restricted successfully',
                className: "bg-red-600 text-white border-none shadow-xl"
            })
            router.refresh()
        }
    }

    const handleHardPurge = async (userId: string) => {
        if (!confirm('CRITICAL: This will PERMANENTLY DELETE the user record. This cannot be undone. Proceed?')) return

        const result = await deleteUserPermanently(userId)
        if (result.error) {
            toast({
                title: 'Purge Failed',
                description: result.error,
                variant: 'destructive',
                className: "bg-black text-white border-red-500 border-2 shadow-2xl"
            })
        } else {
            toast({
                title: 'User Purged',
                description: 'User record removed from core database.',
                className: "bg-emerald-600 text-white border-none shadow-xl"
            })
            router.refresh()
        }
    }

    const getAvatarColor = (email: string) => {
        const colors = [
            'from-blue-500 to-indigo-600',
            'from-purple-500 to-violet-600',
            'from-pink-500 to-rose-600',
            'from-green-500 to-emerald-600',
            'from-amber-500 to-orange-600',
            'from-indigo-500 to-blue-600',
        ]
        const index = email.charCodeAt(0) % colors.length
        return colors[index]
    }

    const getInitials = (name: string | null, email: string) => {
        if (name) {
            const parts = name.split(' ')
            if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            return name.slice(0, 2).toUpperCase()
        }
        return email.slice(0, 2).toUpperCase()
    }

    return (
        <div className="space-y-6">
            {/* Search and Filters - High Performance Layout */}
            <div className="flex flex-col lg:flex-row gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-all duration-300">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                        placeholder="Filter by credentials or nomenclature..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-12 h-14 bg-white dark:bg-slate-950 border-slate-200/50 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-900 dark:text-white"
                    />
                </div>

                <div className="flex gap-4">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="h-14 px-6 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer min-w-[150px] transition-all"
                    >
                        <option value="all">All Access</option>
                        <option value="admin">Administrators</option>
                        <option value="user">Standard Users</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="h-14 px-6 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer min-w-[150px] transition-all"
                    >
                        <option value="all">Any Status</option>
                        <option value="active">Active leads</option>
                        <option value="inactive">Suspended</option>
                    </select>

                    <Button
                        onClick={handleSearch}
                        className="h-14 px-8 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] shadow-xl transition-all active:scale-95"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Sync View
                    </Button>
                </div>
            </div>

            {/* Users Table - High Density & Visual Hierarchy */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Member</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Authority Unit</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Control Panel</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.map((user) => (
                                <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-all duration-300">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(user.email)} flex items-center justify-center text-white font-black text-sm shadow-lg transform group-hover:scale-110 transition-transform duration-300 shadow-indigo-500/20`}>
                                                {getInitials(user.full_name, user.email)}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 dark:text-white tracking-tight text-base group-hover:text-indigo-600 transition-colors">
                                                    {user.full_name || user.name || 'Anonymous User'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                                                    <Mail className="h-3 w-3 text-slate-400" />
                                                    {user.email}
                                                </div>
                                                {user.mobile && (
                                                    <div className="text-[10px] text-indigo-500/70 font-black flex items-center gap-1.5 mt-0.5 uppercase tracking-tighter">
                                                        <Phone className="h-2.5 w-2.5" />
                                                        {user.mobile}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={cn(
                                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                            user.role === 'admin'
                                                ? 'bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200/50'
                                                : 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200/50'
                                        )}>
                                            <Shield className="h-3 w-3" />
                                            {user.role || 'Personnel'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        {user.country ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                    <span>{user.country.flag}</span>
                                                    <span>{user.subdivision?.name || user.country_subdivision?.name || 'N/A'}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.country.name}</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest opacity-40">Not Specified</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all",
                                            user.is_active
                                                ? 'bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50'
                                                : 'bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200/50'
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", user.is_active ? "bg-emerald-500" : "bg-red-500")}></div>
                                            {user.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {!user.is_active && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleResendInvite(user.id)}
                                                    className="h-10 w-10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl"
                                                    title="Re-dispatch Invitation"
                                                >
                                                    <Mail className="h-4.5 w-4.5" />
                                                </Button>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => router.push(`/settings/users/${user.id}`)}
                                                className="h-10 w-10 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl"
                                                title="View/Edit Intelligence"
                                            >
                                                <Edit className="h-4.5 w-4.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleToggleStatus(user.id, user.is_active ?? false)}
                                                className={cn(
                                                    "h-10 w-10 rounded-xl transition-all",
                                                    user.is_active
                                                        ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                                                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                                )}
                                                title={user.is_active ? 'Suspend Operations' : 'Restore Operations'}
                                            >
                                                <Power className="h-4.5 w-4.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleHardPurge(user.id)}
                                                className="h-10 w-10 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl"
                                                title="Permanent Removal"
                                            >
                                                <Trash2 className="h-4.5 w-4.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Portfolio */}
                {pages > 1 && (
                    <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <span>Viewing</span>
                            <span className="text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full shadow-sm">{users.length}</span>
                            <span>of</span>
                            <span className="text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full shadow-sm">{total}</span>
                            <span>Members</span>
                        </div>
                        <div className="flex gap-2">
                            {Array.from({ length: pages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => {
                                        const params = new URLSearchParams(window.location.search)
                                        params.set('page', page.toString())
                                        router.push(`/settings/users?${params.toString()}`)
                                    }}
                                    className={cn(
                                        "h-10 min-w-[40px] px-3 rounded-xl font-black text-xs transition-all shadow-sm",
                                        page === currentPage
                                            ? 'bg-indigo-600 text-white shadow-indigo-500/30 scale-110'
                                            : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md'
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
