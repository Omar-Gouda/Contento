import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Contento",
    short_name: "Contento",
    description: "Premium content operations for agencies managing clients, ideas, reports, and approvals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0F0B1A",
    theme_color: "#7C3AED",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/android-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
