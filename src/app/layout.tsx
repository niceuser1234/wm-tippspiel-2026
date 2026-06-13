import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tippspiel-haberstroh.vercel.app"),
  title: "WM 2026 Tippspiel",
  description:
    "Tippspiel zur FIFA Weltmeisterschaft 2026 — tippen, zittern, Topf gewinnen. Haberstroh & Friends.",
  openGraph: {
    title: "WM 2026 Tippspiel ⚽",
    description: "Tippen · Zittern · Topf gewinnen — Haberstroh & Friends",
    type: "website",
    locale: "de_DE",
    siteName: "WM 2026 Tippspiel",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "WM 2026 Tippspiel ⚽",
    description: "Tippen · Zittern · Topf gewinnen — Haberstroh & Friends",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
