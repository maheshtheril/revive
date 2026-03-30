'use client'

import { useState } from "react"
import { ProductForm } from "@/components/inventory/product-form"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

interface CreateProductModalProps {
    suppliers: any[]
    taxRates: any[]
    uoms: any[]
    categories: any[]
    manufacturers: any[]
    uomCategories: any[]
}

export function CreateProductModal({
    suppliers,
    taxRates,
    uoms,
    categories,
    manufacturers,
    uomCategories
}: CreateProductModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    const handleSuccess = () => {
        setIsOpen(false)
        router.refresh()
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md shadow-blue-900/10 transition-colors flex items-center gap-2"
            >
                <Plus className="h-4 w-4" />
                Create Product
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Create New Product</DialogTitle>
                        <DialogDescription>
                            Enter details to add a new product to your inventory.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100 p-6">
                        <ProductForm
                            suppliers={suppliers}
                            taxRates={taxRates}
                            uoms={uoms}
                            categories={categories}
                            manufacturers={manufacturers}
                            uomCategories={uomCategories}
                            onSuccess={handleSuccess}
                            onCancel={() => setIsOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
