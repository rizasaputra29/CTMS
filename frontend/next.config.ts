import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    // Enable persistent caching for faster rebuilds
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
  },

  // Development optimizations
  devIndicators: {
    position: "bottom-right",
  },

  // Fast refresh settings
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in memory
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },

  // TypeScript config
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "./tsconfig.json",
  },

  // Image optimization (keep default for dev)
  images: {
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Experimental features for better DX
  experimental: {
    // Optimize package imports for common libraries
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
      "date-fns",
    ],
    // Enable React Compiler when ready
    // reactCompiler: true,
  },

  // Logging for debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Headers for development
  async headers() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/:path*",
            headers: [
              {
                key: "X-DNS-Prefetch-Control",
                value: "on",
              },
            ],
          },
        ]
      : [];
  },

  // Redirect old URLs to new paths
  async redirects() {
    return [
      {
        source: "/admin/analytics/grade-configuration",
        destination: "/admin/evaluation-setup/grade-configuration",
        permanent: true,
      },
    ];
  },

  // Webpack custom config (only used when not using Turbopack)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
