import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { DoctorsClientPage } from "@/components/hms/doctors/doctors-client-page"
import { randomUUID } from "crypto"

export default async function DoctorsPage({
    searchParams
}: {
    searchParams: Promise<{
        q?: string
    }>
}) {
    const { q } = await searchParams;
    const query = q || ''

    const session = await auth()
    const tenantId = session?.user?.tenantId
    const companyId = session?.user?.companyId

    if (!tenantId || !companyId) {
        return <div className="p-12 text-center font-bold text-red-500 bg-red-50 rounded-3xl">Session Context Missing. Please re-login.</div>
    }

    // Fetch master data - If anything is empty, we perform a world-class seed
    let [departments, roles, specializations] = await Promise.all([
        prisma.hms_departments.findMany({
            where: { tenant_id: tenantId, is_active: true },
            select: { id: true, name: true, parent_id: true },
            orderBy: { name: 'asc' }
        }),
        prisma.hms_roles.findMany({
            where: { tenant_id: tenantId, is_active: true },
            select: { id: true, name: true, is_clinical: true },
            orderBy: { name: 'asc' }
        }),
        prisma.hms_specializations.findMany({
            where: { tenant_id: tenantId, is_active: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ])

    // World-class auto-seeding if data is missing
    if (departments.length < 5 || roles.length < 5) {
        // Departments Seeding (Optimized)
        const deptNames = ["Clinical Services", "Accounts & Finance", "Human Resources", "Administration", "Pharmacy", "Laboratory", "Emergency (ER)"];
        const deptPromises = deptNames
            .filter(name => !departments.find(d => d.name === name))
            .map(name => prisma.hms_departments.create({
                data: { id: randomUUID(), tenant_id: tenantId, company_id: companyId, name, code: name.substring(0, 3).toUpperCase() }
            }));

        // Roles Seeding (Optimized)
        const roleData = [
            { name: "Senior Consultant", clinical: true },
            { name: "Resident Doctor", clinical: true },
            { name: "Nursing Supervisor", clinical: true },
            { name: "Accountant", clinical: false },
            { name: "Administrator", clinical: false },
            { name: "Front Desk Executive", clinical: false },
            { name: "HR Manager", clinical: false }
        ];
        const rolePromises = roleData
            .filter(r => !roles.find(role => role.name === r.name))
            .map(r => prisma.hms_roles.create({
                data: { id: randomUUID(), tenant_id: tenantId, company_id: companyId, name: r.name, is_clinical: r.clinical }
            }));

        // Execute all creates in parallel
        await Promise.all([...deptPromises, ...rolePromises]);

        // Re-fetch after seeding
        [departments, roles, specializations] = await Promise.all([
            prisma.hms_departments.findMany({ where: { tenant_id: tenantId, is_active: true }, select: { id: true, name: true, parent_id: true }, orderBy: { name: 'asc' } }),
            prisma.hms_roles.findMany({ where: { tenant_id: tenantId, is_active: true }, select: { id: true, name: true, is_clinical: true }, orderBy: { name: 'asc' } }),
            prisma.hms_specializations.findMany({ where: { tenant_id: tenantId, is_active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
        ]);
    }

    // Fetch clinicians
    const doctors = await prisma.hms_clinicians.findMany({
        where: {
            tenant_id: tenantId,
            ...(query ? {
                OR: [
                    { first_name: { contains: query, mode: 'insensitive' } },
                    { last_name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                    { hms_specializations: { name: { contains: query, mode: 'insensitive' } } }
                ]
            } : {})
        },
        include: {
            hms_roles: true,
            hms_specializations: true
        },
        orderBy: [
            { is_active: 'desc' },
            { first_name: 'asc' }
        ]
    })

    const stats = {
        total: doctors.length,
        active: doctors.filter(d => d.is_active === true).length,
        specializations: new Set(doctors.map(d => d.hms_specializations?.name).filter(Boolean)).size
    }

    return (
        <div className="p-6">
            <DoctorsClientPage
                doctors={JSON.parse(JSON.stringify(doctors))}
                stats={stats}
                departments={JSON.parse(JSON.stringify(departments))}
                roles={JSON.parse(JSON.stringify(roles))}
                specializations={JSON.parse(JSON.stringify(specializations))}
            />
        </div>
    )
}
