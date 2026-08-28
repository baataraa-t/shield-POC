import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ShieldProvider } from "@/components/ShieldProvider";
import { ShieldScript } from "@/components/ShieldScript";
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
  title: "SHIELD Device Intelligence POC",
  description:
    "Next.js proof of concept for SHIELD device intelligence and fraud validation",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <ShieldScript />
        <ShieldProvider>{children}</ShieldProvider>
      </body>
    </html>
  );
}
