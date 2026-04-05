'use server'

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function getTenantBrandingByHost(slugOverride?: string) {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const cleanHost = host.toLowerCase().replace(/^www\./, '').split(':')[0];
    const appBrand = process.env.NEXT_PUBLIC_APP_BRAND?.toUpperCase();

    try {
        // 1. Database Lookup for Custom Tenants (Highest Priority)

        if (appBrand === 'ZIONA' || appBrand === 'CLOUD_HMS' || host.toLowerCase().includes('cloud-hms')) {
            return {
                app_name: "Ziona ERP",
                logo_url: "/logo-ziona.svg",
                name: "Ziona Solutions",
                isPublic: true
            };
        }

        let tenant = null;

        // 1. Database Lookup for Custom Tenants (Highest Priority)
        // This allows users to override hardcoded defaults via the dashboard
        if (slugOverride || cleanHost) {
            const hostParts = cleanHost.split('.');
            const firstPart = hostParts[0];

            tenant = await prisma.tenant.findFirst({
                where: slugOverride ? { slug: slugOverride } : {
                    OR: [
                        { domain: cleanHost },
                        { domain: host },
                        { slug: firstPart }
                    ]
                },
                select: {
                    id: true,
                    app_name: true,
                    logo_url: true,
                    name: true,
                    metadata: true,
                    company_settings: {
                        select: {
                            company: {
                                select: {
                                    logo_url: true
                                }
                            }
                        }
                    }
                }
            });
        }

        if (tenant) {
            const meta = (tenant.metadata as any) || {};
            const isPublic = meta.registration_enabled !== false;
            return {
                app_name: tenant.app_name || "Ziona ERP",
                logo_url: tenant.logo_url || (tenant.company_settings?.[0]?.company?.logo_url) || "/logo-ziona.svg",
                name: tenant.name || "Ziona Solutions",
                isPublic
            };
        }

        // 3. System Fallback: Newest Tenant
        tenant = await prisma.tenant.findFirst({
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                app_name: true,
                logo_url: true,
                name: true,
                metadata: true,
                company_settings: {
                    select: {
                        company: {
                            select: {
                                logo_url: true
                            }
                        }
                    }
                }
            }
        });

        const meta = (tenant?.metadata as any) || {};
        const isPublic = meta.registration_enabled !== false;

        return {
            app_name: tenant?.app_name || "Ziona ERP",
            logo_url: tenant?.logo_url || (tenant?.company_settings?.[0]?.company?.logo_url) || "/logo-ziona.svg",
            name: tenant?.name || "Ziona Solutions",
            isPublic
        };

    } catch (error) {
        console.error("Failed to fetch tenant branding:", error);
        return {
            app_name: "Ziona ERP",
            logo_url: "/logo-ziona.svg",
            name: "Ziona Solutions",
            isPublic: true
        };
    }
}
