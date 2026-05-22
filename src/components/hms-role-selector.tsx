'use client'

import { updateUserHMSRoles } from "@/app/actions/user"
import { useState } from "react"
import { Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

type Role = {
    id: string
    name: string
    description: string | null
}

export default function HMSRoleSelector({ userId, allRoles, currentRoleIds }: {
    userId: string,
    allRoles: Role[],
    currentRoleIds: string[]
}) {
    const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(currentRoleIds))
    const [isSaving, setIsSaving] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const toggleRole = (roleId: string) => {
        const next = new Set(selectedRoles)
        if (next.has(roleId)) {
            next.delete(roleId)
        } else {
            next.add(roleId)
        }
        setSelectedRoles(next)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await updateUserHMSRoles(userId, Array.from(selectedRoles))
            toast({
                title: "Roles Updated",
                description: "User platform roles have been saved successfully.",
                className: "bg-indigo-600 text-white border-none shadow-2xl"
            })
            router.refresh()
        } catch (e: any) {
            toast({
                title: "Update Failed",
                description: e?.message || "Could not save role changes.",
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Assigned Platform Roles</h3>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allRoles.map((role) => {
                    const isSelected = selectedRoles.has(role.id)
                    return (
                        <div
                            key={role.id}
                            onClick={() => toggleRole(role.id)}
                            className={`cursor-pointer border rounded-lg p-3 transition-all ${isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`mt-1 h-2 w-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-gray-300'}`} />
                                <div>
                                    <div className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                        {role.name}
                                    </div>
                                    {role.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{role.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
