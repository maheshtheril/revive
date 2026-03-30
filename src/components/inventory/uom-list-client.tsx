'use client'

import { Ruler, Edit2, Trash2 } from "lucide-react"
import { useState } from "react"
import { deleteUOM } from "@/app/actions/inventory"
import { CreateUOMForm } from "@/components/inventory/create-uom-form"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

export function UOMListClient({ uoms }: { uoms: any[] }) {
    const [editingUom, setEditingUom] = useState<any>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleEdit = (uom: any) => {
        setEditingUom(uom);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this unit?")) {
            await deleteUOM(id);
            toast({
                title: "Unit Deleted",
                description: "The unit of measure has been removed successfully.",
            });
        }
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingUom(null);
    };

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {uoms.map((u: any, i: number) => {
                    return (
                        <div
                            key={u.id}
                            className="group bg-white rounded-3xl border border-gray-200 p-6 hover:shadow-xl hover:-translate-y-1 hover:border-purple-300 transition-all duration-300 flex flex-col justify-between h-full relative overflow-hidden"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            {/* Decorative background element */}
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full opacity-50 group-hover:scale-150 group-hover:from-purple-50 group-hover:to-purple-100/50 transition-transform duration-700 ease-out z-0" />

                            <div className="relative z-10 flex items-start justify-between mb-8">
                                <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm bg-purple-100 text-purple-600 border border-purple-200">
                                    <Ruler className="h-6 w-6" />
                                </div>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                    <button
                                        onClick={() => handleEdit(u)}
                                        className="p-2.5 bg-gray-50 text-gray-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-xl transition-all shadow-sm"
                                        title="Edit Unit"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u.id)}
                                        className="p-2.5 bg-gray-50 text-gray-600 hover:text-red-700 hover:bg-red-50/80 rounded-xl transition-all shadow-sm"
                                        title="Delete Unit"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-extrabold text-gray-900 text-xl tracking-tight">
                                        {u.name}
                                    </h3>
                                    {u.uom_type === 'reference' ? (
                                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-widest shadow-sm border border-purple-200">
                                            Base Unit
                                        </span>
                                    ) : (
                                        (() => {
                                            const baseUnit = uoms.find((bu: any) => bu.category_id === u.category_id && bu.uom_type === 'reference');
                                            const baseName = baseUnit ? baseUnit.name : 'Base Units';
                                            return (
                                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-widest shadow-sm border border-blue-200">
                                                    {`1 ${u.name} = ${Number(u.ratio)} ${baseName}`}
                                                </span>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-gray-200 rounded-[2rem] shadow-2xl">
                    <DialogHeader className="p-8 pb-0 bg-gradient-to-br from-purple-50/50 to-white">
                        <DialogTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            Edit Unit of Measure
                        </DialogTitle>
                        <p className="text-gray-500 font-medium mt-2">
                            Modify the packaging dimensions and conversion ratios.
                        </p>
                    </DialogHeader>
                    <div className="p-8">
                        <CreateUOMForm 
                            key={editingUom?.id || 'edit'} 
                            initialData={editingUom} 
                            uoms={uoms} 
                            onSuccess={closeDialog}
                        />
                        <button 
                            onClick={closeDialog}
                            className="w-full mt-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors py-2"
                        >
                            Cancel and Close
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
