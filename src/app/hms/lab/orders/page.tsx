import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function LabOrdersPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Laboratory Order Register</h1>
            <p className="text-gray-600">The full historical search for laboratory orders is being prepared.</p>
            <div className="mt-8 p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center bg-gray-50">
               <div className="text-4xl mb-4">🔬</div>
               <p className="text-sm font-medium text-gray-500 italic">"Processing high-resolution diagnostic data..."</p>
            </div>
        </div>
    )
}
