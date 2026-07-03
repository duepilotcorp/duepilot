import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://duepilot-puce.vercel.app"),
  title: {
    default: "DuePilot — Le copilote administratif des entreprises",
    template: "%s | DuePilot",
  },
  description:
    "DuePilot aide les entreprises à centraliser, suivre et anticiper leurs échéances administratives, réglementaires et contractuelles.",
  applicationName: "DuePilot",
  openGraph: {
    title: "DuePilot — Le copilote administratif des entreprises",
    description:
      "Centralisez vos échéances administratives, réglementaires et contractuelles dans un espace simple, fiable et sécurisé.",
    url: "https://duepilot-puce.vercel.app",
    siteName: "DuePilot",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
