import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's1.anilist.co',
        port: '',
        pathname: '/file/anilistcdn/**',
      },
      {
        protocol: 'https',
        hostname: 's2.anilist.co',
        port: '',
        pathname: '/file/anilistcdn/**',
      },
      {
        protocol: 'https',
        hostname: 's3.anilist.co',
        port: '',
        pathname: '/file/anilistcdn/**',
      },
      {
        protocol: 'https',
        hostname: 's4.anilist.co',
        port: '',
        pathname: '/file/anilistcdn/**',
      },
    ],
  },
};

export default nextConfig;
