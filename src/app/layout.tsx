import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OSProvider } from "@/context/OSContext";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PERSONAL OS — AI Personal Execution & Growth System",
  description:
    "Transform your long-term vision into meaningful daily action with AI-powered planning, goals, habits, deep focus, and reflection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <OSProvider>
          <AppShell>{children}</AppShell>
        </OSProvider>
      </body>
    </html>
  );
}

