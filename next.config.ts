import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js e sharp usano binding nativi: escluderli dal bundling/tracing
  // di Turbopack evita l'errore "asset is not placeable in ESM chunks".
  serverExternalPackages: ['@resvg/resvg-js', 'sharp'],
};

export default nextConfig;
