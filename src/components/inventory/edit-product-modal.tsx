'use client'

import { useState } from "react"
import { ProductForm } from "./product-form"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

interface EditProductModalProps {
    product: any;
    suppliers: any[];
    taxRates: any[];
    uoms: any[];
    categories: any[];
    manufacturers: any[];
    uomCategories: any[];
    batches?: any[];
    isOpen: boolean;
    onClose: () => void;
}

export function EditProductModal({
    product,
    suppliers,
    taxRates,
    uoms,
    categories,
    manufacturers,
    uomCategories,
    batches = [],
    isOpen,
    onClose
}: EditProductModalProps) {
    const router = useRouter();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
                <DialogHeader className="sr-only">
                    <DialogTitle>Edit Product</DialogTitle>
                    <DialogDescription>
                        Update product details and stock information.
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
                        initialData={product}
                        batches={batches}
                        onSuccess={() => {
                            onClose();
                            router.refresh();
                        }}
                        onCancel={onClose}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
