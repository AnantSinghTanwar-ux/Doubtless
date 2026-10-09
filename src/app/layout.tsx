import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

// Self-hosted (latin, variable) so the app starts without reaching the Google Fonts CDN.
const dmSans = localFont({ src: "./fonts/DMSans.woff2", variable: "--font-dm-sans", weight: "100 1000", display: "swap" });
const caveat = localFont({ src: "./fonts/Caveat.woff2", variable: "--font-caveat", weight: "400 700", display: "swap" });
const fraunces = localFont({ src: "./fonts/Fraunces.woff2", variable: "--font-fraunces", weight: "100 900", display: "swap" });
const jetbrains = localFont({ src: "./fonts/JetBrainsMono.woff2", variable: "--font-jetbrains", weight: "100 800", display: "swap" });

export const metadata: Metadata = {
  title: "Sθlvε — AI Education OS",
  description:
    "Intelligent doubt resolution powered by AI. Get personalized explanations, practice, and connect with expert teachers.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${dmSans.variable} ${jetbrains.variable} ${caveat.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-snow">
          Skip to content
        </a>
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <VaultProvider>{children}</VaultProvider>
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
