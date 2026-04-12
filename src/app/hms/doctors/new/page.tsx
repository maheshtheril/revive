import { createDoctor } from "@/app/actions/doctor"
import Link from "next/link"
import { ArrowLeft, User, Mail, FileBadge, Stethoscope, Briefcase } from "lucide-react"

export default function NewDoctorPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/hms/doctors" className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Add New Clinician</h1>
                    <p className="text-gray-500">Register a new clinical staff member.</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <form action={async (formData) => {
                    'use server'
                    await createDoctor(formData)
                }} className="space-y-6">

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input name="first_name" type="text" placeholder="Given Name" required className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input name="last_name" type="text" placeholder="Family Name" required className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Email & License */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input name="email" type="email" placeholder="doctor@hospital.com" required className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">License No</label>
                            <div className="relative">
                                <FileBadge className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input name="license_no" type="text" placeholder="LIC-12345" className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Role & Specialization */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    name="role"
                                    type="text"
                                    placeholder="e.g. Doctor, Nurse, Surgeon"
                                    defaultValue="Clinician"
                                    required
                                    className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">If role doesn't exist, it will be created.</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                            <div className="relative">
                                <Stethoscope className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    name="specialization"
                                    type="text"
                                    placeholder="e.g. Cardiology, Pediatrics"
                                    required
                                    className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">New specializations will be auto-added.</p>
                            </div>
                        </div>
                    </div>


                    <div className="pt-4 flex gap-4">
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            Register Clinician
                        </button>
                        <Link href="/hms/doctors" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
