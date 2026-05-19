import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build auto-contido para Docker (só o necessário vai na imagem).
  output: "standalone",
  experimental: {
    serverActions: {
      // Composite PNGs (1500x1000, transparent) podem facilmente passar de 1MB,
      // que é o default e estava a rebentar com o submit do formulário.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
