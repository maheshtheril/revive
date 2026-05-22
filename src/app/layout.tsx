import type { Metadata } from "next";
// Version 1.0.6 - Hardened Against DB Failures
// OFFLINE COMPATIBLE: Disabled Google Fonts to bypass fetch errors during restricted builds
// import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/components/auth-provider";
import { LocalizationProvider } from "@/contexts/localization-context";
import { auth } from "@/auth";

// Force dynamic rendering for all pages to prevent build-time database access
export const dynamic = 'force-dynamic'

const inter = { variable: "font-sans" };
const robotoMono = { variable: "font-mono" };

import { getTenantBrandingByHost } from "./actions/branding";
import { auditAndFixMenuPermissions } from "./actions/navigation";

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  // HARDENED: Never crash the app if branding DB lookup fails
  let branding: any = null;
  try {
    branding = await getTenantBrandingByHost();
  } catch (e) {
    console.error('[layout] generateMetadata branding fetch failed:', e);
  }

  const appName = branding?.app_name || branding?.name || "Enterprise Management";
  const logoUrl = branding?.logo_url || "/logo.svg";

  return {
    title: appName,
    description: `Professional Enterprise Management System for ${appName}.`,
    icons: {
      icon: [
        { url: logoUrl, type: "image/png" },
      ],
      shortcut: [logoUrl],
      apple: [
        { url: logoUrl, sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: '/manifest.webmanifest?v=1.0.6',
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: appName,
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // [CRITICAL] DISABLED SELF-HEALING AUDIT - This was causing pool exhaustion and 'Skeleton' hangs on LAN
  // auditAndFixMenuPermissions().catch(e => console.error('[layout] background audit failed:', e));
  
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider session={session}>
            <LocalizationProvider>
              {children}
              <Toaster />
              <SonnerToaster position="top-center" richColors />
            </LocalizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
