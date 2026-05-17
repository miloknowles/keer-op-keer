import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { MobileGuard } from "@/components/MobileGuard";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keer op Keer 2 — Online Multiplayer",
  description:
    "Play Keer op Keer 2 online with friends. A free roll-and-write multiplayer game.",
  metadataBase: new URL("https://keer2.vercel.app"),
  openGraph: {
    title: "Keer op Keer 2 — Online Multiplayer",
    description: "Play Keer op Keer 2 online with friends.",
    url: "https://keer2.vercel.app",
    siteName: "Keer op Keer 2",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Keer op Keer 2 — Online Multiplayer",
    description: "Play Keer op Keer 2 online with friends.",
  },
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
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <MobileGuard />
        <Toaster />
      </body>
    </html>
  );
}
