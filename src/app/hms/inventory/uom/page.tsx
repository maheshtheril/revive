import { getUOMs, deleteUOM } from "@/app/actions/inventory"
import { Scale, X, Ruler, Trash2, Box, Edit2, PackageOpen, HelpCircle } from "lucide-react"
import Link from "next/link"
import { CreateUOMForm } from "@/components/inventory/create-uom-form"
import { UOMListClient } from "@/components/inventory/uom-list-client"
import { seedPharmacyUOMs } from "@/app/actions/uom"
import { revalidatePath } from "next/cache"

export default async function UOMMasterPage() {
    const uoms = await getUOMs();

    return (
        <div className="min-h-screen bg-gray-50/40 pb-20">
            {/* Ultra Premium Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="absolute inset-0 h-[300px] bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-purple-500/20 shadow-lg">
                                    <Scale className="h-7 w-7 text-white" />
                                </div>
                                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                                    Units of Measure
                                </h1>
                            </div>
                            <p className="text-gray-500 text-lg font-medium leading-relaxed pl-[3.25rem]">
                                Define standard packaging dimensions and units for your inventory tracking.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto pl-[3.25rem] md:pl-0">
                            <form action={async () => {
                                'use server'
                                await seedPharmacyUOMs()
                                revalidatePath('/hms/inventory/uom')
                            }}>
                                <button type="submit" className="group flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 rounded-xl font-bold transition-all w-full md:w-auto min-w-[200px] shadow-sm">
                                    <PackageOpen className="h-5 w-5" />
                                    Seed Pharmacy Defaults
                                </button>
                            </form>
                            <Link
                                href="/hms/inventory/products"
                                className="group flex justify-center items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all font-bold shadow-sm"
                            >
                                <X className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                                <span className="hidden sm:inline">Close</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                    {/* Left Column: Create Form */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="sticky top-8">
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                                        New Unit
                                    </h3>
                                </div>
                                <CreateUOMForm uoms={uoms} />
                            </div>

                            {/* Info Card */}
                            <div className="mt-8 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border border-gray-700 text-gray-300 shadow-xl">
                                <h4 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
                                    <HelpCircle className="h-5 w-5 text-purple-400" />
                                    How Dimensions Work
                                </h4>
                                <div className="space-y-4 text-sm font-medium">
                                    <div className="flex gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0" />
                                        <p><strong>Base Unit:</strong> The smallest standard form (e.g. PCS). All stock is ultimately counted in Base Units.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                        <p><strong>Derived Units:</strong> E.g. "Box of 100". Acts purely as a multiplier against the base.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                                        <p><strong>Transactions:</strong> You can purchase/sell using ANY unit linked to a dimension.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: List */}
                    <div className="lg:col-span-7">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                                Configured Units
                                <span className="bg-purple-100 text-purple-700 text-sm font-bold px-3 py-1 rounded-full border border-purple-200 shadow-sm">
                                    {uoms.length}
                                </span>
                            </h2>
                        </div>

                        {uoms.length === 0 ? (
                            <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center shadow-sm">
                                <div className="mx-auto h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                    <Box className="h-10 w-10 text-gray-400/80" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">No Units Found</h3>
                                <p className="text-gray-500 text-lg max-w-md mx-auto font-medium">
                                    Configuration is empty. You can build your own units on the left or seed defaults.
                                </p>
                            </div>
                        ) : (
                            <UOMListClient uoms={uoms} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

