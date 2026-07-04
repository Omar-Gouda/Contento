import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Contento",
  title: {
    default: "Contento",
    template: "%s | Contento",
  },
  description:
    "Premium content operations software for agencies managing clients, ideas, tasks, reports, approvals, and growth.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Contento",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Contento",
    description:
      "Plan content, manage clients, review ideas, and keep every campaign moving with Contento.",
    siteName: "Contento",
    type: "website",
    images: [
      {
        url: "/android-512.png",
        width: 512,
        height: 512,
        alt: "Contento",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Contento",
    description:
      "Premium content operations software for modern marketing agencies.",
    images: ["/android-512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "mask-icon",
        url: "/mask-icon.svg",
        color: "#7c3aed",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          {children}
          <PwaProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
