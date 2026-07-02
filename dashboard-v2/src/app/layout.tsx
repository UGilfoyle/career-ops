import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import VisitorTracker from "@/components/VisitorTracker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Career-Ops | AI Career Command Center",
  description: "Advanced multi-tenant AI platform for career ascension, job scanning, and resume tailoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <VisitorTracker />
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}


