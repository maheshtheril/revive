import { getCategories, getTaxRates, deleteCategory } from "@/app/actions/inventory"
import { getAccounts } from "@/app/actions/accounting/chart-of-accounts"
import { Trash2, Tag, X, Box, Layers, Edit2 } from "lucide-react"
import Link from "next/link"
import { CreateCategoryForm } from "@/components/inventory/create-category-form"

export default async function CategoryMasterPage(props: { searchParams: Promise<{ edit?: string }> }) {
    const searchParams = await props.searchParams;
    const categories = await getCategories();
    const taxRates = await getTaxRates();
    const accountsResponse = await getAccounts();
    const accounts = accountsResponse.success ? accountsResponse.data || [] : [];

    const categoryToEdit = searchParams.edit ? categories.find(c => c.id === searchParams.edit) || null : null;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
                                    <Layers className="h-6 w-6 text-white" />
                                </div>
                                Category Master
                            </h1>
                            <p className="text-gray-500 max-w-2xl text-lg">
                                Organize your inventory with smart categories and automated tax rules.
                            </p>
                        </div>
                        <Link
                            href="/hms/inventory/products"
                            className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all font-medium shadow-sm"
                        >
                            <X className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                            Close Manager
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Left Column: Create Form */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-8">
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 overflow-hidden">
                                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        Add New Category
                                    </h3>
                                </div>
                                <div className="p-2">
                                    <CreateCategoryForm 
                                        taxRates={taxRates} 
                                        categoryToEdit={categoryToEdit} 
                                        accounts={accounts}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 p-5 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm leading-relaxed">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <Tag className="h-4 w-4" />
                                    Pro Tip
                                </h4>
                                Assigning a default tax rate to a category will automatically apply that tax to any new product you add to this category.
                            </div>
                        </div>
                    </div>

                    {/* Right Column: List */}
                    <div className="lg:col-span-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                Active Categories
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200">
                                    {categories.length}
                                </span>
                            </h2>
                        </div>

                        {categories.length === 0 ? (
                            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                                <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Box className="h-8 w-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">No Categories Yet</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    Create your first category to start organizing your products efficiently.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {categories.map(category => {
                                    const taxRate = taxRates.find(t => t.id === category.default_tax_rate_id);

                                    return (
                                        <div
                                            key={category.id}
                                            className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-200/50 transition-all duration-300 flex flex-col justify-between h-full"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                                                    <Tag className="h-5 w-5" />
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                                                    <Link 
                                                        href={`/hms/inventory/categories?edit=${category.id}`}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit Category"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Link>
                                                    <form action={async () => {
                                                        'use server'
                                                        await deleteCategory(category.id)
                                                    }}>
                                                        <button
                                                            type="submit"
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Category"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">
                                                    {category.name}
                                                </h3>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {taxRate ? (
                                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                                                             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                             {taxRate.name} ({taxRate.rate}%)
                                                         </div>
                                                     ) : (
                                                         <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 text-gray-500 text-xs font-medium border border-gray-200">
                                                             No Tax
                                                         </span>
                                                     )}
                                                     
                                                     {category.income_account_id && (
                                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                                                             Inc: {accounts.find(a => a.id === category.income_account_id)?.name || 'Account Not Found'}
                                                         </div>
                                                     )}

                                                     {category.expense_account_id && (
                                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-100">
                                                             Exp: {accounts.find(a => a.id === category.expense_account_id)?.name || 'Account Not Found'}
                                                         </div>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
