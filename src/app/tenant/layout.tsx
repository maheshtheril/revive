import Link from 'next/link'
import { Activity, Users, Calendar, LayoutDashboard, Settings, LogOut, Stethoscope, Receipt, Shield, Building2 } from 'lucide-react'
import { signOut } from '@/auth'
import { getMenuItems } from '../actions/navigation'
import { CompanySwitcher } from '@/components/company-switcher'
import { getCurrentCompany } from '../actions/company'
import { getTenant } from '../actions/tenant'

// Map icon strings to components
const IconMap: any = {
    LayoutDashboard, Users, Calendar, Stethoscope, Receipt, Settings, Shield, Building2
};

export default async function TenantLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const menuItems = await getMenuItems();
    const currentCompany = await getCurrentCompany();
    const tenant = await getTenant();

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-100 bg-white flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {tenant?.logo_url ? (
                                <img src={tenant.logo_url} alt={tenant.app_name || 'Logo'} className="h-full w-full object-contain" />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                                    <Building2 size={20} />
                                </div>
                            )}
                        </div>
                        <span className="font-bold text-gray-900 truncate">
                            {tenant?.app_name || tenant?.name || "Tenant"}
                        </span>
                    </div>
                    <CompanySwitcher initialActiveCompany={currentCompany} tenant={tenant} />
                </div>

                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {/* Add Tenant Specific Menu Items if not returned by getMenuItems */}
                    {/* Assuming getMenuItems returns standard user menu. We might want to append Tenant items if they are not there. */}
                    {/* For now, just render what getMenuItems provides, which acts as the main navigation */}

                    {menuItems.map((group: any) => (
                        <div key={group.module.module_key}>
                            {group.module.module_key !== 'general' && (
                                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    {group.module.name}
                                </h3>
                            )}

                            <div className="space-y-1">
                                {group.items.map((item: any) => (
                                    <MenuItem key={item.key} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Ensure Tenant Management link is visible or highlighted? */}
                    {/* Ideally 'Tenant Management' is a section. If not in menuItems, we could add it manually here if needed. */}
                    {/* But the user is IN Tenant Management. They probably want to navigate BACK to HMS/CRM too. */}
                </nav>
                <div className="p-4 border-t border-gray-100">
                    <form action={async () => {
                        'use server';
                        await signOut({ redirectTo: '/login' });
                    }}>
                        <button className="flex items-center justify-center gap-3 w-full px-4 py-3 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-sm hover:shadow-md font-medium group">
                            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            <span>Sign Out</span>
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white p-4 shadow-sm md:hidden flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200 overflow-hidden flex items-center justify-center">
                            {tenant?.logo_url ? (
                                <img src={tenant.logo_url} alt={tenant.app_name || 'Logo'} className="h-full w-full object-contain" />
                            ) : (
                                <Activity className="text-blue-600 h-5 w-5" />
                            )}
                        </div>
                        <span className="font-bold text-gray-800">{tenant?.app_name || tenant?.name || "Tenant Portal"}</span>
                    </div>
                    {/* Mobile Actions */}
                    <div className="flex gap-2">
                        <form action={async () => {
                            'use server';
                            await signOut({ redirectTo: '/login' });
                        }}>
                            <button className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Sign Out">
                                <LogOut className="h-5 w-5" />
                            </button>
                        </form>
                    </div>
                </header>
                <div className="p-8">
                    {/* Breadcrumb or Title Area could go here */}
                    {children}
                </div>
            </main>
        </div>
    )
}

function MenuItem({ item, level = 0 }: { item: any, level?: number }) {
    const Icon = IconMap[item.icon] || (level === 0 ? Activity : null);
    const hasChildren = item.other_menu_items && item.other_menu_items.length > 0;

    const paddingLeftClass = level === 0 ? "px-3" : level === 1 ? "pl-9 pr-3" : "pl-14 pr-3";

    if (hasChildren) {
        return (
            <details className="group/item">
                <summary
                    className={`flex items-center gap-3 ${paddingLeftClass} py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors cursor-pointer list-none justify-between`}
                >
                    <span className="flex items-center gap-3">
                        {Icon && <Icon className="h-5 w-5" />}
                        <span className={level > 0 ? "text-sm" : ""}>{item.label}</span>
                    </span>
                    <span className="transform group-open/item:rotate-90 transition-transform text-gray-400">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.33331 8.33333L6.66665 4.99999L3.33331 1.66666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                </summary>
                <div className="space-y-1 mt-1">
                    {item.other_menu_items.map((sub: any) => (
                        <MenuItem key={sub.key} item={sub} level={level + 1} />
                    ))}
                </div>
            </details>
        );
    }

    return (
        <Link
            href={item.url || '#'}
            className={`flex items-center gap-3 ${paddingLeftClass} py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors`}
        >
            {Icon && <Icon className="h-5 w-5" />}
            <span className={level > 0 ? "text-sm" : ""}>{item.label}</span>
        </Link>
    )
}
