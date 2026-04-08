import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "mcnrnwghzjexnatjilrg.supabase.co" },
    ],
    // Serve modern formats when the browser supports them
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 30 days at the edge
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
