import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "mcnrnwghzjexnatjilrg.supabase.co" },
    ],
  },
};

export default nextConfig;
