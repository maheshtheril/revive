'use client'

import { createUOM, updateUOM } from "@/app/actions/inventory"
import { Scale, RefreshCw, X } from "lucide-react"
import { useFormStatus } from "react-dom"
import { useState, useRef, useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

function SubmitButton({ isEdit }: { isEdit: boolean }) {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:transform-none disabled:shadow-none mt-4"
        >
            {pending ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
                <Scale className="h-5 w-5" />
            )}
            {pending ? "Saving Unit..." : isEdit ? "Update Unit" : "Create Unit"}
        </button>
    )
}

export function CreateUOMForm({ initialData, uoms = [], onSuccess }: { initialData?: any, uoms?: any[], onSuccess?: () => void }) {
    const [state, formAction] = useActionState(initialData ? updateUOM : createUOM, { error: "", success: false })
    const formRef = useRef<HTMLFormElement>(null)
    const router = useRouter()

    const [name, setName] = useState(initialData?.name || "");
    const [isAlternative, setIsAlternative] = useState(initialData?.uom_type === 'derived' || false);
    const [ratio, setRatio] = useState(initialData?.ratio || "");

    const initialBaseUnit = initialData?.uom_type === 'derived' 
        ? uoms.find((u: any) => u.category_id === initialData.category_id && u.uom_type === 'reference')?.id 
        : "";
    const [baseUnitId, setBaseUnitId] = useState(initialBaseUnit || "");
    const baseUnits = uoms.filter((u: any) => u.uom_type === 'reference');

    useEffect(() => {
        if (state.success) {
            if (!initialData) {
                formRef.current?.reset();
                setName("");
                setIsAlternative(false);
                setRatio("");
                setBaseUnitId("");
            } else {
                // For edit mode, we might want to close the popup or just show success
                if (onSuccess) {
                    const timer = setTimeout(() => {
                        onSuccess();
                    }, 1000); // Give user a moment to see success
                    return () => clearTimeout(timer);
                }
            }
        }
    }, [state.success, initialData, onSuccess])

    return (
        <form ref={formRef} action={formAction} className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all duration-300">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="type" value={isAlternative ? "derived" : "reference"} />

            {/* Error & Success States */}
            {state?.error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <X className="h-5 w-5 flex-shrink-0" />
                    {state.error}
                </div>
            )}
            {state?.success && !initialData && (
                <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-200 font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    Unit saved successfully.
                </div>
            )}

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Unit Name
                    </label>
                    <input
                        name="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Dozen, Pack, Palette, PCS"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400 font-semibold text-gray-900 shadow-sm"
                    />
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setIsAlternative(!isAlternative)}>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">Alternative Unit?</h4>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed mt-0.5">Check this if the unit contains multiple items (like a Box of 50 PCS).</p>
                    </div>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${isAlternative ? 'bg-purple-600' : 'bg-gray-200'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${isAlternative ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                </div>

                {isAlternative && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Base Unit
                            </label>
                            <select
                                name="baseUnitId"
                                required={isAlternative}
                                value={baseUnitId}
                                onChange={(e) => setBaseUnitId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-semibold text-gray-900 shadow-sm"
                            >
                                <option value="" disabled>Select a base unit...</option>
                                {baseUnits.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                                Conversion Ratio (How many base units in 1 {name || "unit"}?)
                            </label>
                            <input
                                name="ratio"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required={isAlternative}
                                value={ratio}
                                onChange={(e) => setRatio(e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full px-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-blue-300 font-semibold text-blue-900 shadow-sm"
                            />
                        </div>
                    </div>
                )}

                <SubmitButton isEdit={!!initialData} />
            </div>
        </form>
    )
}
