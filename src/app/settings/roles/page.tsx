import { getRoles } from "@/app/actions/role";
import { auditAndFixMenuPermissions } from "@/app/actions/navigation"; // Import fix
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Key, Plus } from "lucide-react";
import Link from "next/link";
import { SeedRolesButton } from "@/components/settings/seed-roles-button";
import { CreateRoleDialog } from "@/components/settings/create-role-dialog";
import { RoleActions } from "@/components/settings/role-actions";
import { RolesList } from "@/components/settings/roles-list";
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { checkPermission } from "@/app/actions/rbac"

export default async function RolesPage() {
    const session = await auth();
    if (!session?.user) redirect('/auth/login');
    
    const hasAccess = await checkPermission('roles:view');
    if (!hasAccess && !session.user.isAdmin && !(session.user as any).isTenantAdmin) {
        redirect('/hms/reception/dashboard');
    }

    // SELF-HEALING: Run audit on page load to ensure data integrity
    await auditAndFixMenuPermissions();

    const result = await getRoles();

    if (result.error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Error Loading Roles</h2>
                    <p className="text-red-700 dark:text-red-300">{result.error}</p>
                </div>
            </div>
        );
    }

    const roles = result.data || [];
    const totalPermissions = roles.reduce((sum, role) => sum + (role.permissions?.length || 0), 0);
    const avgPermissions = roles.length > 0 ? Math.round(totalPermissions / roles.length) : 0;

    return (
        <div className="min-h-screen bg-futuristic">
            {/* Animated Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
                <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
                <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
            </div>

            <div className="relative container mx-auto py-8 space-y-8 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-gradient-primary flex items-center gap-3 tracking-tighter">
                            <Shield className="h-10 w-10 text-indigo-600" />
                            Roles & Permissions
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">
                            Manage access control and permissions • <span className="text-slate-900 dark:text-white font-bold">{roles.length} roles active</span>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <SeedRolesButton />
                        <Link href="/settings/permissions">
                            <Button variant="outline" className="bg-white/40 border-slate-200/50 hover:bg-white text-slate-700 dark:text-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900 backdrop-blur-md">
                                <Key className="h-4 w-4 mr-2" />
                                View Permissions
                            </Button>
                        </Link>
                        <CreateRoleDialog />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="glass-card bg-white/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-white/20 shadow-xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield className="h-16 w-16 text-indigo-500" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Total Roles</p>
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                                <Shield className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white">{roles.length}</div>
                    </div>

                    <div className="glass-card bg-white/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-white/20 shadow-xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Key className="h-16 w-16 text-cyan-500" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Total Permissions</p>
                            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-600">
                                <Key className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white">{totalPermissions}</div>
                    </div>

                    <div className="glass-card bg-white/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-white/20 shadow-xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Plus className="h-16 w-16 text-pink-500" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest">Avg Permissions</p>
                            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-600">
                                <Plus className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white">{avgPermissions}</div>
                    </div>
                </div>

                {/* Roles List */}
                <div className="glass-card bg-white/40 dark:bg-slate-900/40 p-1 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="h-5 w-5 text-indigo-500" />
                            Role Definitions
                        </h2>
                    </div>

                    <div className="p-6">
                        <RolesList initialRoles={roles} />
                    </div>
                </div>
            </div>
        </div>
    );
}
