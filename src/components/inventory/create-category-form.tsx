'use client'

import { useActionState } from "react"
import { createCategory, updateCategory } from "@/app/actions/inventory"
import { Plus, Save, X } from "lucide-react"
import Link from 'next/link'

const initialState = {
    error: ""
}

interface CreateCategoryFormProps {
    taxRates: { id: string; name: string; rate: number }[]
    accounts: { id: string; name: string; code: string; type: string }[]
    categoryToEdit?: { 
        id: string; 
        name: string; 
        default_tax_rate_id: string | null;
        income_account_id: string | null;
        expense_account_id: string | null;
    } | null
}

export function CreateCategoryForm({ taxRates, accounts, categoryToEdit }: CreateCategoryFormProps) {
    const actionToUse = categoryToEdit ? updateCategory : createCategory
    const [state, action, isPending] = useActionState(actionToUse, initialState)

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit sticky top-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {categoryToEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {categoryToEdit ? "Edit Category" : "New Category"}
                </h2>
                {categoryToEdit && (
                    <Link href="/hms/inventory/categories" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </Link>
                )}
            </div>
            <form action={action} className="space-y-4">
                {state && 'error' in state && state.error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                        {state.error}
                    </div>
                )}

                {categoryToEdit && <input type="hidden" name="id" value={categoryToEdit.id} />}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                    <input
                        name="name"
                        required
                        defaultValue={categoryToEdit?.name || ""}
                        placeholder="e.g. Antibiotics"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate</label>
                    <select
                        name="taxRateId"
                        defaultValue={categoryToEdit?.default_tax_rate_id || ""}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                        <option value="">No Tax</option>
                        {taxRates.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name.includes(t.rate.toString()) ? t.name : `${t.name} (${t.rate}%)`}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Products in this category will default to this tax rate.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Income Account</label>
                    <select
                        name="incomeAccountId"
                        defaultValue={categoryToEdit?.income_account_id || ""}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                        <option value="">Default Income</option>
                        {accounts.filter(a => a.type === 'Revenue' || a.type === 'Other Income').map(a => (
                            <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Classification for sales (e.g. OP Income).</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expense Account</label>
                    <select
                        name="expenseAccountId"
                        defaultValue={categoryToEdit?.expense_account_id || ""}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                        <option value="">Default Expense</option>
                        {accounts.filter(a => a.type === 'Expense' || a.type === 'Cost of Revenue').map(a => (
                            <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Classification for purchases (e.g. Med Expenses).</p>
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>Processing...</>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            {categoryToEdit ? "Update Category" : "Create Category"}
                        </>
                    )}
                </button>
            </form>
        </div>
    )
}
