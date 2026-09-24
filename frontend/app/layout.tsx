import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Smooth } from "@/components/smooth";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Tiro_Devanagari_Hindi } from "next/font/google";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import "../styles/landing.css";

/** Devanagari brand word only (R3). Latin stays on fontsource Fraunces/Inter. */
const tiro = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: ["400"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VyapaarAI Copilot",
  description: "Bharat ke MSMEs ka AI copilot — AI suggests. Owner decides.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1210" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Tiro+Devanagari+Sanskrit&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`min-h-screen ${tiro.variable}`}>
        <ThemeProvider>
          <LangProvider>
            <Smooth>
              {children}
            </Smooth>
            <Toaster richColors closeButton position="top-right" />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
