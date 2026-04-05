import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcrypt'],
  async redirects() {
    return [
      {
        source: '/dashboard/rbac/users',
        destination: '/settings/users',
        permanent: true,
      },
      {
        source: '/dashboard/rbac/roles',
        destination: '/settings/roles',
        permanent: true,
      },
      {
        source: '/hms/inventory/operations/receive',
        destination: '/hms/purchasing/receipts/new',
        permanent: true,
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // PERMANENT CACHE BUSTING: Forces the browser to refresh all resources on every restart.
  generateBuildId: async () => {
    return `ziona-hms-${Date.now()}`;
  },
};

export default nextConfig;
