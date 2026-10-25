import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AegisBank — Simple, secure digital banking",
  description: "AegisBank makes everyday banking simple, secure, and easy to understand.",
  keywords: ["AegisBank", "banking", "secure banking", "money transfers", "spending insights"],
  authors: [{ name: "AegisBank" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "AegisBank — Simple, secure digital banking",
    description: "Manage your money with confidence.",
    siteName: "AegisBank",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AegisBank",
    description: "Simple, secure digital banking",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
