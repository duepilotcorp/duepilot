import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppNavigationExperience from "@/components/AppNavigationExperience";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.duepilot.fr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DuePilot — Le copilote administratif des entreprises",
    template: "%s | DuePilot",
  },
  description:
    "DuePilot aide les entreprises à centraliser, suivre et anticiper leurs échéances administratives, réglementaires et contractuelles.",
  applicationName: "DuePilot",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "DuePilot — Le copilote administratif des entreprises",
    description:
      "Centralisez vos échéances administratives, réglementaires et contractuelles dans un espace simple, fiable et sécurisé.",
    url: siteUrl,
    siteName: "DuePilot",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DuePilot — Le copilote administratif des entreprises",
    description:
      "Centralisez vos échéances administratives, réglementaires et contractuelles dans un espace simple, fiable et sécurisé.",
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full flex flex-col">
        <AppNavigationExperience />
        {children}
      </body>
    </html>
  );
}
