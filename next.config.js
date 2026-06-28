/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Only suppress fs for the client bundle (Leaflet SSR workaround)
    if (!isServer) {
      config.resolve.fallback = { fs: false };
    }
    return config;
  },
};

module.exports = nextConfig;
