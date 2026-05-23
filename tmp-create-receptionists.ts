import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    const company = await prisma.company.findFirst();
    if (!company) {
        console.error('No company found');
        return;
    }

    const role = await prisma.hms_role.findFirst({
        where: { name: { contains: 'reception', mode: 'insensitive' } }
    });

    if (!role) {
        console.error('Reception role not found in hms_role');
        return;
    }

    console.log(`Found Reception Role: ${role.name} (${role.id})`);

    const defaultPassword = await bcrypt.hash('password123', 10);

    const usersToCreate = [
        { email: 'reception1@hospital.com', name: 'Receptionist One', password: defaultPassword },
        { email: 'reception2@hospital.com', name: 'Receptionist Two', password: defaultPassword },
        { email: 'reception3@hospital.com', name: 'Receptionist Three', password: defaultPassword }
    ];

    for (const u of usersToCreate) {
        let existing = await prisma.app_user.findFirst({ where: { email: u.email } });
        if (!existing) {
            existing = await prisma.app_user.create({
                data: {
                    tenant_id: company.tenant_id,
                    company_id: company.id,
                    name: u.name,
                    full_name: u.name,
                    email: u.email,
                    password: u.password,
                    role: 'Receptionist',
                    is_active: true
                }
            });
            console.log(`Created user ${u.email}`);
        } else {
            console.log(`User ${u.email} already exists.`);
        }

        // Link in hms_user_roles
        const roleLink = await prisma.hms_user_roles.findFirst({
            where: { user_id: existing.id, role_id: role.id }
        });

        if (!roleLink) {
            await prisma.hms_user_roles.create({
                data: {
                    user_id: existing.id,
                    role_id: role.id
                }
            });
            console.log(`Assigned Receptionist role to ${u.email}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
