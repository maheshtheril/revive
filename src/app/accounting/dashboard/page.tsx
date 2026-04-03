"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { 
    LayoutGrid, Database, Receipt, CreditCard, FileText, 
    TrendingUp, Package, Users, Landmark, Settings, 
    ArrowRight, ChevronRight, Activity, Search, ShieldCheck,
    Clock, History, Plus
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AccountingGatewayPage() {
    const router = useRouter();

    const sections = [
        {
            title: "MASTERS (F1)",
            description: "Manage Core Entities",
            icon: <Database className="h-5 w-5 text-blue-500" />,
            color: "blue",
            items: [
                { name: "Account Chart", path: "/accounting/masters/accounts", icon: <Landmark className="h-3.5 w-3.5" /> },
                { name: "Medicine Catalog", path: "/hms/inventory/products", icon: <Package className="h-3.5 w-3.5" /> },
                { name: "Supplier Master", path: "/hms/inventory/suppliers", icon: <Users className="h-3.5 w-3.5" /> },
                { name: "Cost Centers", path: "/accounting/masters/cost-centers", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
            ]
        },
        {
            title: "TRANSACTIONS (F2)",
            description: "Daily Entry & Vouchers",
            icon: <Receipt className="h-5 w-5 text-emerald-500" />,
            color: "emerald",
            items: [
                { name: "Purchase Entry", path: "/hms/purchasing/receipts", icon: <Plus className="h-3.5 w-3.5" /> },
                { name: "Payment Vouchers", path: "/hms/billing/payments", icon: <CreditCard className="h-3.5 w-3.5" /> },
                { name: "Journal Vouchers", path: "/accounting/vouchers/journal", icon: <FileText className="h-3.5 w-3.5" /> },
                { name: "Expense Entry", path: "/accounting/vouchers/expenses", icon: <Activity className="h-3.5 w-3.5" /> },
            ]
        },
        {
            title: "REPORTS (F3)",
            description: "Audit & Analysis",
            icon: <TrendingUp className="h-5 w-5 text-indigo-500" />,
            color: "indigo",
            items: [
                { name: "General Ledger", path: "/accounting/reports/ledger", icon: <FileText className="h-3.5 w-3.5" /> },
                { name: "Stock Register", path: "/hms/inventory/reports/ledger", icon: <History className="h-3.5 w-3.5" /> },
                { name: "Stock Summary", path: "/hms/inventory/reports/stock", icon: <Package className="h-3.5 w-3.5" /> },
                { name: "Trial Balance", path: "/accounting/reports/trial-balance", icon: <TrendingUp className="h-3.5 w-3.5" /> },
            ]
        }
    ];

    return (
        <div className="flex flex-1 flex-col gap-8 p-4 md:p-12 bg-slate-50 dark:bg-slate-950 min-h-screen font-sans">
            {/* Professional Header */}
            <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                            <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                            GATEWAY OF <span className="text-indigo-600">ZIONA</span>
                        </h1>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] ml-1 opacity-70">Integrated ERP Accounting v.2035</p>
                </div>
                
                <div className="flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-border/50 p-2 rounded-2xl shadow-sm">
                    <div className="flex flex-col items-end px-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Audit</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white mt-1 uppercase">03 Apr 2026 - 18:24</span>
                    </div>
                    <Button size="icon" className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-black text-white shadow-lg">
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Main Gateway Grid */}
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
                {sections.map((section, idx) => (
                    <Card key={idx} className="border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                        <CardHeader className="p-8 pb-4">
                            <div className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg",
                                section.color === 'blue' ? "bg-blue-50 text-blue-600" : 
                                section.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                                {section.icon}
                            </div>
                            <CardTitle className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase">{section.title}</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-400 opacity-80">{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex flex-col gap-1.5">
                                {section.items.map((item, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => router.push(item.path)}
                                        className="flex items-center justify-between p-4 rounded-[20px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group/item"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-slate-100/50 dark:bg-slate-800 flex items-center justify-center group-hover/item:bg-white dark:group-hover/item:bg-slate-700 shadow-sm transition-all">
                                                {item.icon}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight group-hover/item:text-indigo-500 transition-colors">
                                                {item.name}
                                            </span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover/item:text-indigo-400 group-hover/item:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions Footer */}
            <div className="max-w-6xl mx-auto w-full px-4 mb-20 text-center">
                <div className="inline-flex items-center gap-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 p-6 rounded-[32px] shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Connection Verified</span>
                    </div>
                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Audit Trail Enforced</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
