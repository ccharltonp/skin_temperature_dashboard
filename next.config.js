/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress Leaflet SSR warnings
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};

module.exports = nextConfig;
