import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/v2",
        destination: "/",
        permanent: true,
      },
      {
        source: "/v2/admin/:path*",
        destination: "/admin/:path*",
        permanent: true,
      },
      {
        source: "/v2/dashboard/:path*",
        destination: "/dashboard/:path*",
        permanent: true,
      },
      {
        source: "/v2/auth/:path*",
        destination: "/auth/:path*",
        permanent: true,
      },
      {
        source: "/v2/modules/:path*",
        destination: "/modules/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
