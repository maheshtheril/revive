import { MetadataRoute } from 'next'
import { getTenantBrandingByHost } from './actions/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    try {
        const branding = await getTenantBrandingByHost();
        const appName = branding?.app_name || "Ziona ERP";
        const shortName = branding?.app_name?.split(' ')[0] || "Ziona";
        const logoUrl = branding?.logo_url || '/logo-ziona.svg';

        return {
            name: appName,
            short_name: shortName,
            description: `World-class ${appName} - Enterprise Management System`,
            start_url: '/',
            display: 'standalone',
            background_color: '#000000',
            theme_color: '#4f46e5',
            icons: [
                {
                    src: `${logoUrl}?v=1.0.5`,
                    sizes: 'any',
                    type: logoUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
                    purpose: 'any',
                },
                {
                    src: '/branding/ziona_logo.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                },
                {
                    src: '/branding/ziona_logo.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                },
            ],
        }
    } catch (error) {
        // Fallback
        const appName = "Enterprise Management";
        return {
            name: appName,
            short_name: appName,
            description: `${appName} - Unified Management System`,
            start_url: '/',
            display: 'standalone',
            background_color: '#000000',
            theme_color: '#4f46e5',
            icons: [
                {
                    src: '/logo-ziona.svg',
                    sizes: 'any',
                    type: 'image/svg+xml',
                    purpose: 'any',
                },
                {
                    src: '/ziona.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                }
            ],
        }
    }
}

