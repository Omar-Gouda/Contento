import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Contento",
    short_name: "Contento",
    description: "Content operations, collaboration, reports, and calendar planning for modern teams.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f0a1f",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  };
}
