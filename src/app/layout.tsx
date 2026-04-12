import type { Metadata } from "next";
// Version 1.0.6 - Hardened Against DB Failures
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/components/auth-provider";
import { LocalizationProvider } from "@/contexts/localization-context";
import { auth } from "@/auth";

// Force dynamic rendering for all pages to prevent build-time database access
export const dynamic = 'force-dynamic'

const inter = Inter({
  variable: "--font-geist-sans", // Keeping variable name consistent with existing CSS
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono", // Keeping variable name consistent with existing CSS
  subsets: ["latin"],
});

import { getTenantBrandingByHost } from "./actions/branding";
import { auditAndFixMenuPermissions } from "./actions/navigation";

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
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

  const appName = branding?.app_name || branding?.name || "Enterprise";
  const logoUrl = branding?.logo_url || "/logo-ziona.svg";

  return {
    title: `${appName} | Antigravity OS`,
    description: `The unified Antigravity-speed Operating System for ${appName} & Enterprise Management.`,
    icons: {
      icon: [
        { url: "/ziona.png", type: "image/png" },
      ],
      shortcut: ["/ziona.png"],
      apple: [
        { url: "/ziona.png", sizes: "180x180", type: "image/png" },
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
  // ASYNC SELF-HEALING: We fire this in the background so it doesn't block the UI render.
  // This prevents the 'Blank Screen' issue caused by Prisma pool exhaustion during startup.
  auditAndFixMenuPermissions().catch(e => console.error('[layout] background audit failed:', e));
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider session={session}>
            <LocalizationProvider>
              {children}
              <Toaster />
            </LocalizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
