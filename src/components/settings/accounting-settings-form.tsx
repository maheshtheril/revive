'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertCircle, BookOpen, Layers, DollarSign, Package, Settings, Calendar, Lock, ShieldCheck } from 'lucide-react'
import { updateAccountingSettings, lockAccountingPeriod } from '@/app/actions/accounting-settings'
import { updatePaymentMappings } from '@/app/actions/settings'
import { useToast } from "@/components/ui/use-toast"
import { CreditCard, Smartphone, Banknote, Building } from 'lucide-react'

export function AccountingSettingsForm({ settings, accounts, taxRates, taxLabel, journals, paymentMappings }: {
    settings: any,
    accounts: any[],
    taxRates: any[],
    taxLabel: string,
    journals: any[],
    paymentMappings: any
}) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [lockLoading, setLockLoading] = useState(false)

    // Separate State for Period Locking (Enterprise Standard)
    const [lockDate, setLockDate] = useState(settings?.lock_date ? new Date(settings.lock_date).toISOString().split('T')[0] : '')

    // Form State (Configuration Only)
    const [formData, setFormData] = useState({
        // General & Journals
        fiscal_year_start: settings?.fiscal_year_start ? new Date(settings.fiscal_year_start).toISOString().split('T')[0] : '2025-04-01',
        fiscal_year_end: settings?.fiscal_year_end ? new Date(settings.fiscal_year_end).toISOString().split('T')[0] : '2026-03-31',
        // lock_date removed
        currency_precision: settings?.currency_precision || 2,
        retained_earnings_account_id: settings?.retained_earnings_account_id || '',
        exchange_gain_loss_account_id: settings?.exchange_gain_loss_account_id || '',

        // Journals Mapping
        sales_journal_id: settings?.sales_journal_id || '',
        purchase_journal_id: settings?.purchase_journal_id || '',
        bank_journal_id: settings?.bank_journal_id || '',
        cash_journal_id: settings?.cash_journal_id || '',
        general_journal_id: settings?.general_journal_id || '',

        // Sales Defaults
        ar_account_id: settings?.ar_account_id || '',
        sales_account_id: settings?.sales_account_id || '',
        sales_discount_account_id: settings?.sales_discount_account_id || '',
        output_tax_account_id: settings?.output_tax_account_id || '',
        default_sale_tax_id: settings?.default_sale_tax_id || '',

        // Purchasing Defaults
        ap_account_id: settings?.ap_account_id || '',
        purchase_account_id: settings?.purchase_account_id || '',
        purchase_discount_account_id: settings?.purchase_discount_account_id || '',
        input_tax_account_id: settings?.input_tax_account_id || '',

        // Inventory
        inventory_asset_account_id: settings?.inventory_asset_account_id || '',
        cogs_account_id: settings?.cogs_account_id || '',
        stock_adjustment_account_id: settings?.stock_adjustment_account_id || '',

        rounding_method: settings?.rounding_method || 'ROUND_HALF_UP',
        default_tax_mode: settings?.default_tax_mode || 'exclusive',
    })

    const [paymentMap, setPaymentMap] = useState(paymentMappings || {
        cash: '',
        upi: '',
        card: '',
        bank_transfer: ''
    })

    const handleLock = async () => {
        setLockLoading(true)
        try {
            const res = await lockAccountingPeriod(lockDate)
            if (res.success) {
                toast({
                    title: "Period Locked",
                    description: `Accounting period locked through ${lockDate || 'Indefinite'}.`,
                    className: "bg-amber-600 text-white border-none"
                })
                router.refresh()
            } else {
                toast({ title: "Error", description: res.error, variant: "destructive" })
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setLockLoading(false)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await updateAccountingSettings(formData)

            if (res.success) {
                toast({
                    title: "Success",
                    description: "Accounting configuration saved.",
                    className: "bg-green-600 text-white border-none"
                })
                router.refresh()
            } else {
                toast({
                    title: "Error",
                    description: res.error || 'Failed to save settings',
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Error",
                description: 'An unexpected error occurred',
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveMappings = async () => {
        setLoading(true)
        try {
            const res = await updatePaymentMappings(paymentMap)
            if (res.success) {
                toast({
                    title: "Mappings Saved",
                    description: "Payment method account mappings updated.",
                    className: "bg-blue-600 text-white border-none"
                })
                router.refresh()
            } else {
                toast({ title: "Error", description: res.error, variant: "destructive" })
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    // EMPTY STATE: If no accounts exist (Self Healing UI)
    if (accounts.length === 0) {
        const handleSeed = async () => {
            setLoading(true);
            const { seedDefaultAccountsAction } = await import('@/app/actions/seed-accounts');
            const res = await seedDefaultAccountsAction();
            if (res.success) {
                toast({ title: "Success", description: "Default accounts created." });
                router.refresh();
            } else {
                toast({ title: "Error", description: "Failed to create accounts: " + res.error, variant: "destructive" });
            }
            setLoading(false);
        };

        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto h-16 w-16 text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Setup Required</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">
                    Your Chart of Accounts is currently empty. We can generate a standard set of ledger accounts for you to get started instantly.
                </p>
                <button
                    onClick={handleSeed}
                    disabled={loading}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 inline-flex items-center gap-3"
                >
                    {loading ? "Generating..." : "Generate Standard Accounts"}
                </button>
            </div>
        )
    }

    // Styles
    const sectionClass = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm relative overflow-hidden";
    const labelClass = "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5";
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all";
    const subLabelClass = "text-xs text-slate-500";

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">

            {/* 0. PERIOD CONTROLS (ENTERPRISE) */}
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <ShieldCheck className="w-24 h-24 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-6 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-amber-600" />
                    Period Control Center
                </h2>
                <div className="flex items-end gap-4 max-w-xl">
                    <div className="flex-1 space-y-1">
                        <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5">Lock Date</label>
                        <input
                            type="date"
                            value={lockDate}
                            onChange={e => setLockDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        />
                        <p className="text-xs text-amber-700 dark:text-amber-400">Transactions on or before this date cannot be modified.</p>
                    </div>
                    <button
                        onClick={handleLock}
                        disabled={lockLoading}
                        className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {lockLoading ? "Locking..." : "Update Lock"}
                    </button>
                </div>
            </div>

            {/* 1. JOURNALS & PERIODS */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <BookOpen className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                    Journals & Financial Year
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-1">
                        <label className={labelClass}>Fiscal Year Start</label>
                        <input type="date" value={formData.fiscal_year_start} onChange={e => setFormData({ ...formData, fiscal_year_start: e.target.value })} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Fiscal Year End</label>
                        <input type="date" value={formData.fiscal_year_end} onChange={e => setFormData({ ...formData, fiscal_year_end: e.target.value })} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Sales Journal</label>
                        <select value={formData.sales_journal_id} onChange={e => setFormData({ ...formData, sales_journal_id: e.target.value })} className={inputClass}>
                            <option value="">Select Journal...</option>
                            {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Purchase Journal</label>
                        <select value={formData.purchase_journal_id} onChange={e => setFormData({ ...formData, purchase_journal_id: e.target.value })} className={inputClass}>
                            <option value="">Select Journal...</option>
                            {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Bank/General Journal</label>
                        <select value={formData.general_journal_id} onChange={e => setFormData({ ...formData, general_journal_id: e.target.value })} className={inputClass}>
                            <option value="">Select Journal...</option>
                            {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. SALES */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <DollarSign className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-green-500 rounded-full"></span>
                    Sales & Receivables
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className={labelClass}>Accounts Receivable</label>
                        <select value={formData.ar_account_id} onChange={e => setFormData({ ...formData, ar_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Receivable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tracks money owed by customers/patients.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Default Income Account</label>
                        <select value={formData.sales_account_id} onChange={e => setFormData({ ...formData, sales_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Revenue' || a.type === 'Income').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Default revenue category for invoices.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Sales Discount Account</label>
                        <select value={formData.sales_discount_account_id} onChange={e => setFormData({ ...formData, sales_discount_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Expense' || a.type === 'Revenue').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tracks discounts given to customers.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Output Tax Account</label>
                        <select value={formData.output_tax_account_id} onChange={e => setFormData({ ...formData, output_tax_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Liability').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tax collected from customers (Liability).</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Default Tax Mode (Billing)</label>
                        <select 
                            value={formData.default_tax_mode} 
                            onChange={e => setFormData({ ...formData, default_tax_mode: e.target.value })} 
                            className={inputClass}
                        >
                            <option value="exclusive">Exclusive (Price + Tax)</option>
                            <option value="inclusive">Inclusive (Price includes Tax)</option>
                            <option value="exempt">Exempt (No Tax for B2C/Unregistered)</option>
                        </select>
                        <p className={subLabelClass}>Determines the default behavior for new Pharmacy bills.</p>
                    </div>
                </div>
            </div>

            {/* 2.5 PAYMENT METHOD MAPPING */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Smartphone className="w-24 h-24" />
                </div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                        Payment Method Ledger Mapping
                    </h2>
                    <button
                        onClick={handleSaveMappings}
                        disabled={loading}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all"
                    >
                        Save Mappings Only
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <label className={labelClass + " flex items-center gap-2"}>
                            <Banknote className="w-4 h-4 text-emerald-500" /> Cash
                        </label>
                        <select
                            value={paymentMap.cash}
                            onChange={e => setPaymentMap({ ...paymentMap, cash: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">Default (1000)</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Receivable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass + " flex items-center gap-2"}>
                            <Smartphone className="w-4 h-4 text-purple-500" /> UPI / QR
                        </label>
                        <select
                            value={paymentMap.upi}
                            onChange={e => setPaymentMap({ ...paymentMap, upi: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">Default (1100)</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Receivable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass + " flex items-center gap-2"}>
                            <CreditCard className="w-4 h-4 text-blue-500" /> Card
                        </label>
                        <select
                            value={paymentMap.card}
                            onChange={e => setPaymentMap({ ...paymentMap, card: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">Default (1100)</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Receivable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass + " flex items-center gap-2"}>
                            <Building className="w-4 h-4 text-slate-500" /> Bank Transfer
                        </label>
                        <select
                            value={paymentMap.bank_transfer}
                            onChange={e => setPaymentMap({ ...paymentMap, bank_transfer: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">Default (1100)</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Receivable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                </div>
                <p className="mt-4 text-xs text-slate-500 italic">
                    Mapping a payment method to a specific ledger account ensures that payments of that type (e.g., UPI) are posted to the correct bank or cash account. If not set, the system defaults to Account 1000 (Cash) or 1100 (Bank).
                </p>
            </div>

            {/* 3. PURCHASES */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Layers className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                    Purchasing & Payables
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className={labelClass}>Accounts Payable</label>
                        <select value={formData.ap_account_id} onChange={e => setFormData({ ...formData, ap_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Liability' || a.type === 'Payable').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tracks money owed to suppliers.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Default Expense Account</label>
                        <select value={formData.purchase_account_id} onChange={e => setFormData({ ...formData, purchase_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Expense').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Default cost category for bills.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Purchase Discount Account</label>
                        <select value={formData.purchase_discount_account_id} onChange={e => setFormData({ ...formData, purchase_discount_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Revenue' || a.type === 'Expense').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tracks discounts received from vendors.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Input Tax Account</label>
                        <select value={formData.input_tax_account_id} onChange={e => setFormData({ ...formData, input_tax_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Asset' || a.type === 'Liability').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Tax paid to vendors (Claimable).</p>
                    </div>
                </div>
            </div>

            {/* 4. INVENTORY */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Package className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                    Inventory (Perpetual)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-1">
                        <label className={labelClass}>Inventory Asset</label>
                        <select value={formData.inventory_asset_account_id} onChange={e => setFormData({ ...formData, inventory_asset_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Asset').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Value of stock on hand.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Cost of Goods Sold (COGS)</label>
                        <select value={formData.cogs_account_id} onChange={e => setFormData({ ...formData, cogs_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Expense' || a.type === 'Cost of Goods Sold').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Expense recognized when stock is sold.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Stock Adjustment</label>
                        <select value={formData.stock_adjustment_account_id} onChange={e => setFormData({ ...formData, stock_adjustment_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Account...</option>
                            {accounts.filter(a => a.type === 'Expense' || a.type === 'Cost of Goods Sold').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>For shrinkage, damage, or corrections.</p>
                    </div>
                </div>
            </div>

            {/* 5. ADVANCED & EQUITY */}
            <div className={sectionClass}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Settings className="w-24 h-24" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-slate-500 rounded-full"></span>
                    Advanced Financials
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <label className={labelClass}>Retained Earnings</label>
                        <select value={formData.retained_earnings_account_id} onChange={e => setFormData({ ...formData, retained_earnings_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Equity...</option>
                            {accounts.filter(a => a.type === 'Equity').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>Accumulated profit/loss year-over-year.</p>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Exchange Gain/Loss</label>
                        <select value={formData.exchange_gain_loss_account_id} onChange={e => setFormData({ ...formData, exchange_gain_loss_account_id: e.target.value })} className={inputClass}>
                            <option value="">Select Gain/Loss Account...</option>
                            {accounts.filter(a => a.type === 'Expense' || a.type === 'Revenue').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                        <p className={subLabelClass}>For realized currency exchange differences.</p>
                    </div>
                </div>
            </div>

            {/* SAVE BUTTON */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                    {loading ? "Saving Settings..." : <><Save className="h-5 w-5" /> Save Configuration</>}
                </button>
            </div>
        </div>
    )
}
