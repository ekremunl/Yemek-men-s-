const basePath = "/Yemek-men-s-";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  // İstemci tarafında (service worker kaydı, yazı tipi dosyaları) taban yola ihtiyaç var.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
