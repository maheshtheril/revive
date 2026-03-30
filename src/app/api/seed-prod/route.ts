
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log("Starting Production Seeding...");

        // 1. Create Tenant
        let tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: {
                    id: crypto.randomUUID(),
                    name: 'Enterprise Prod',
                    slug: 'enterprise-prod',
                    mode: 'production',
                    billing_plan: 'enterprise',
                    app_name: 'Cloud HMS Enterprise',
                    logo_url: 'https://cdn-icons-png.flaticon.com/512/3063/3063823.png'
                }
            });
            console.log("Created Tenant:", tenant.id);
        } else {
            console.log("Tenant already exists:", tenant.id);
        }

        // 2. Create Company
        let company = await prisma.company.findFirst({ where: { tenant_id: tenant.id } });
        if (!company) {
            company = await prisma.company.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenant.id,
                    name: `${tenant.name} Hospital`, // Replaced hardcoded 'Main Hospital'
                    industry: 'Healthcare',
                }
            });
            console.log("Created Company:", company.id);
        }

        // 2.2 Initialize Masters (UOMs, Departments, etc.)
        const { initializeTenantMasters } = await import("@/lib/services/tenant-init");
        await initializeTenantMasters(tenant.id, company.id, prisma);
        console.log("Masters Initialized.");

        // 2.5 Seed Currencies & Countries (Essential Master Data)
        const commonCurrencies = [
            { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
            { code: 'USD', name: 'US Dollar', symbol: '$' },
            { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'British Pound', symbol: '£' },
        ];

        for (const cur of commonCurrencies) {
            const existing = await prisma.currencies.findUnique({ where: { code: cur.code } });
            if (!existing) {
                await prisma.currencies.create({
                    data: {
                        code: cur.code,
                        name: cur.name,
                        symbol: cur.symbol,
                        is_active: true
                    }
                });
            }
        }
        console.log("Currencies Seeded.");

        const commonCountries = [
            { iso2: 'IN', iso3: 'IND', name: 'India', flag: '🇮🇳', region: 'Asia' },
            { iso2: 'US', iso3: 'USA', name: 'United States', flag: '🇺🇸', region: 'Americas' },
            { iso2: 'AE', iso3: 'ARE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Asia' },
            { iso2: 'GB', iso3: 'GBR', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
        ];

        for (const c of commonCountries) {
            const existing = await prisma.countries.findUnique({ where: { iso2: c.iso2 } });
            if (!existing) {
                await prisma.countries.create({
                    data: {
                        iso2: c.iso2,
                        iso3: c.iso3,
                        name: c.name,
                        flag: c.flag,
                        region: c.region,
                        is_active: true
                    }
                });
            }
        }
        console.log("Countries Seeded.");

        // 3. Enable Modules
        const modules = ['hms', 'crm', 'inventory', 'accounting'];
        for (const mod of modules) {
            const existing = await prisma.tenant_module.findUnique({
                where: {
                    tenant_id_module_key: {
                        tenant_id: tenant.id,
                        module_key: mod
                    }
                }
            });

            // Lookup module_id if possible
            const moduleInfo = await prisma.modules.findFirst({
                where: { module_key: mod }
            });

            if (!existing) {
                await prisma.tenant_module.create({
                    data: {
                        id: crypto.randomUUID(), // Explicit ID
                        tenant_id: tenant.id,
                        module_key: mod,
                        module_id: moduleInfo?.id, // Optional
                        enabled: true
                    }
                });
            } else {
                await prisma.tenant_module.update({
                    where: { id: existing.id },
                    data: { enabled: true }
                });
            }
        }
        console.log("Modules Enabled.");

        // 4. Create Admin User (Logic remains same as it uses raw SQL)
        const adminEmail = 'admin@saaserp.com';
        const password = 'password123'; 

        const existingUser = await prisma.app_user.findFirst({
            where: { email: { equals: adminEmail, mode: 'insensitive' } }
        });

        if (!existingUser) {
            await prisma.$executeRaw`
                INSERT INTO app_user (id, tenant_id, company_id, email, password, is_active, is_admin, is_tenant_admin, name, role, created_at)
                VALUES (${crypto.randomUUID()}::uuid, ${tenant.id}::uuid, ${company.id}::uuid, ${adminEmail}, crypt(${password}, gen_salt('bf')), true, true, true, 'System Admin', 'admin', NOW())
            `;
            console.log("Admin User Created.");
        }

        // 5. Seed Professional Standard Products (Fees, Meds, Diagnostics)
        const standardProducts = [
            { sku: 'REG-FEE', name: 'Patient Registration Fee', uom: 'EACH', price: 100, is_service: true, stockable: false },
            { sku: 'CONS-GEN', name: 'General Consultation', uom: 'VISIT', price: 250, is_service: true, stockable: false },
            { sku: 'CONS-SPEC', name: 'Specialist Consultation', uom: 'VISIT', price: 500, is_service: true, stockable: false },
            { sku: 'PARA-500', name: 'Paracetamol 500mg', uom: 'TAB', price: 5, is_service: false, stockable: true },
            { sku: 'AMOX-500', name: 'Amoxicillin 500mg Strip', uom: 'STRIP', price: 85, is_service: false, stockable: true },
            { sku: 'SYR-5ML', name: 'Disposable Syringe 5ml', uom: 'PCS', price: 15, is_service: false, stockable: true },
            { sku: 'CBC-TEST', name: 'Complete Blood Count (CBC)', uom: 'TEST', price: 450, is_service: true, stockable: false },
            { sku: 'CXR-SCAN', name: 'Chest X-Ray', uom: 'SCAN', price: 1200, is_service: true, stockable: false },
        ];

        for (const p of standardProducts) {
            const existing = await prisma.hms_product.findFirst({
                where: { tenant_id: tenant.id, sku: p.sku }
            });

            if (!existing) {
                await prisma.hms_product.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: tenant.id,
                        company_id: company.id,
                        sku: p.sku,
                        name: p.name,
                        description: `Default ${p.name}`,
                        price: p.price,
                        is_service: p.is_service,
                        is_stockable: p.stockable,
                        is_active: true,
                        uom: p.uom
                    }
                });
            } else {
                await prisma.hms_product.update({
                    where: { id: existing.id },
                    data: { price: p.price, is_active: true, is_service: p.is_service, uom: p.uom }
                });
            }
        }
        console.log("Standard Products Seeded.");

        // VERIFY IMMEDIATE
        const verify = await prisma.$queryRaw`
            SELECT id FROM app_user 
            WHERE email = ${adminEmail} 
            AND password = crypt(${password}, password)
        ` as any[];

        const verificationSuccess = verify.length > 0;
        console.log("Password Verification Result:", verificationSuccess);

        return NextResponse.json({
            success: true,
            message: "Production Database Seeded Successfully!",
            details: {
                tenantId: tenant.id,
                companyId: company.id,
                adminEmail,
                verificationSuccess
            }
        });

    } catch (error: any) {
        console.error("Seeding Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
