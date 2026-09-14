import { fileURLToPath } from 'node:url'
/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXTEX_DIST_DIR || '.next',
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
}

export default nextConfig
