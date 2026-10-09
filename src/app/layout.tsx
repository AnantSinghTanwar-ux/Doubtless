import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Urbanist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import StarField from "@/components/ui/StarField";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });
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
  themeColor: "#08080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${urbanist.variable} ${jetbrains.variable}`}>
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
