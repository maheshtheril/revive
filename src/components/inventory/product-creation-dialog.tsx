'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/inventory/product-form";
import { getSuppliers, getTaxRates, getUOMs, getCategories, getManufacturers, getUOMCategories } from "@/app/actions/inventory";
import { Loader2 } from "lucide-react";

interface ProductCreationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (newlyCreatedProductId?: string, newlyCreatedProductName?: string) => void;
}

export function ProductCreationDialog({ isOpen, onClose, onSuccess }: ProductCreationDialogProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<{
        suppliers: any[];
        taxRates: any[];
        uoms: any[];
        categories: any[];
        manufacturers: any[];
        uomCategories: any[];
    }>({
        suppliers: [],
        taxRates: [],
        uoms: [],
        categories: [],
        manufacturers: [],
        uomCategories: []
    });

    useEffect(() => {
        if (isOpen && data.categories.length === 0) {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const [suppliers, taxRates, uoms, categories, manufacturers, uomCategories] = await Promise.all([
                        getSuppliers(),
                        getTaxRates(),
                        getUOMs(),
                        getCategories(),
                        getManufacturers(),
                        getUOMCategories()
                    ]);
                    setData({ suppliers, taxRates, uoms, categories, manufacturers, uomCategories });
                } catch (err) {
                    console.error("Failed to load product master data", err);
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto p-0 bg-gray-50/50 backdrop-blur-3xl border-gray-200">
                <div className="hidden">
                    <DialogTitle>Create New Product</DialogTitle>
                </div>
                {isLoading ? (
                    <div className="flex h-[400px] items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="ml-3 text-sm font-medium text-gray-500">Loading Master Data...</span>
                    </div>
                ) : (
                    <div className="p-1">
                        {/* We wrap ProductForm and override its router.push behavior roughly via onSuccess if possible,
                            but ProductForm currently hard navigates.
                            We might need to create a wrapper or modify ProductForm to accept onSuccess.
                            For now, let's just render it. The user has to click 'Cancel' to close or we rely on the form functionality.
                            However, ProductForm uses router.push('/hms/inventory/products'). We might want to intercept that if we could.
                         */}
                        {/* 
                            IMPORTANT: ProductForm currently redirects on success. 
                            Ideally we should add an onSuccess prop to ProductForm to prevent redirect and just close the modal.
                            I will modify ProductForm next to support this.
                         */}
                        <ProductForm
                            suppliers={data.suppliers}
                            taxRates={data.taxRates}
                            uoms={data.uoms}
                            categories={data.categories}
                            manufacturers={data.manufacturers}
                            uomCategories={data.uomCategories}
                            onSuccess={(createdId, createdName) => {
                                if (onSuccess) onSuccess(createdId, createdName);
                                onClose();
                            }}
                            onCancel={onClose}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
