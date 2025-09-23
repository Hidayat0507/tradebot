import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Re-enable linting on builds now that warnings are being addressed
  experimental: {
    // missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
