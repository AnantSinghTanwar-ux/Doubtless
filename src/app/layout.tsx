import type { Metadata, Viewport } from "next";
import { Caveat, DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import StarField from "@/components/ui/StarField";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Doubtless — AI Education OS",
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
        <StarField />
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
