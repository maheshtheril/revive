'use client'

import Link from 'next/link'
import { Building2, Stethoscope, Settings2, ChevronRight, Zap, Calculator } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface LinkItem {
    name: string;
    href: string;
    badge?: string;
}

interface Category {
    title: string;
    description: string;
    icon: React.ReactNode;
    links: LinkItem[];
}

export default function SettingsHubPage() {
    const categories: Category[] = [
        {
            title: 'Organization',
            description: 'Manage companies, business units, and tenant settings.',
            icon: <Building2 className="h-6 w-6 text-blue-600" />,
            links: [
                { name: 'Companies & Branches', href: '/hms/settings/companies' },
            ]
        },
        {
            title: 'Clinical Care',
            description: 'Define masters for prescriptions, lab tests, and clinical protocols.',
            icon: <Stethoscope className="h-6 w-6 text-emerald-600" />,
            links: [
                { name: 'Clinical Protocols (Masters)', href: '/hms/settings/prescriptions', badge: 'New' },
            ]
        },
        {
            title: 'Finance & Accounting',
            description: 'Configure charts of accounts, taxes, and payment mappings.',
            icon: <Calculator className="h-6 w-6 text-indigo-600" />,
            links: [
                { name: 'Accounting Configuration', href: '/settings/accounting' },
                { name: 'Payment Ledger Mapping', href: '/settings/accounting' },
            ]
        }
    ]

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Settings</h1>
                <p className="text-slate-500 font-medium">Configure your platform environment and clinical workflows.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {categories.map((cat) => (
                    <Card key={cat.title} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center gap-4 p-6 bg-slate-50/50">
                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                {cat.icon}
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold">{cat.title}</CardTitle>
                                <CardDescription>{cat.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-2">
                                {cat.links.map((link: any) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-700">{link.name}</span>
                                            {link.badge && (
                                                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    {link.badge}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
