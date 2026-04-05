import { getUsers, getAvailableRoles } from "@/app/actions/users"
import { Users, TrendingUp, UserCheck, UserX } from "lucide-react"
import { UserTable } from "@/components/users/user-table"
import { InviteUserDialog } from "@/components/users/invite-user-dialog"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

interface PageProps {
    searchParams: {
        search?: string
        role?: string
        status?: 'active' | 'inactive' | 'all'
        page?: string
    }
}

export default async function UsersPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = parseInt(params.page || '1')
    const result = await getUsers({
        search: params.search,
        role: params.role,
        status: params.status,
        page,
        limit: 20
    })

    const roles = await getAvailableRoles()

    const users = Array.isArray(result) ? [] : result.users || []
    const total = Array.isArray(result) ? 0 : result.total || 0
    const pages = Array.isArray(result) ? 0 : result.pages || 0
    const currentPage = Array.isArray(result) ? 1 : result.currentPage || 1

    const activeUsers = users.filter(u => u.is_active).length
    const inactiveUsers = users.filter(u => !u.is_active).length

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 min-h-screen">
            <Toaster />

            {/* Premium Header Architecture */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-[0_10px_25px_rgba(79,70,229,0.4)] transform hover:rotate-6 transition-transform">
                            <Users className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                            Command Center
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 ml-1">
                        <span className="h-1 w-12 bg-indigo-600 rounded-full"></span>
                        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                            Human Resources & Authorization Matrix
                        </p>
                    </div>
                </div>
                <div className="bg-white/50 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-slate-100">
                    <InviteUserDialog roles={roles} />
                </div>
            </div>

            {/* Stats Cards - Glassmorphic Intelligence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Personnel', value: total, icon: Users, color: 'indigo', growth: '+5%' },
                    { label: 'Active Deployment', value: activeUsers, icon: UserCheck, color: 'emerald', growth: 'Stable' },
                    { label: 'Pending Access', value: inactiveUsers, icon: UserX, color: 'rose', growth: 'Requires Action' },
                    { label: 'Org Velocity', value: '+12%', icon: TrendingUp, color: 'blue', growth: 'Monthly' }
                ].map((stat, i) => (
                    <div key={i} className="group relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] transition-all duration-500 overflow-hidden">
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</p>
                            </div>
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg",
                                `bg-${stat.color}-100 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400`
                            )}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 relative z-10">
                            <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full",
                                stat.growth.startsWith('+') ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            )}>
                                {stat.growth}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Intelligence update</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* User Table Terminal */}
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                <UserTable
                    users={users}
                    total={total}
                    pages={pages}
                    currentPage={currentPage}
                />
            </div>
        </div>
    )
}
