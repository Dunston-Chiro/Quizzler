import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
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
  title: "Quizzler — Live Competition Platform",
  description:
    "High-stakes, real-time college quiz competition engine with Neobrutalism & Proctoring Studio",
};

function NavbarFallback() {
  return (
    <header className="border-b-4 border-black bg-[#FFE600] px-4 md:px-8 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black text-[#FFE600] font-black text-lg flex items-center justify-center border-2 border-black">
            Q
          </div>
          <span className="font-black text-xl tracking-tight uppercase">
            Quizzler
          </span>
        </div>
        <div className="h-8 w-24 bg-white/50 border-2 border-black" />
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FFFDF8] text-black">
        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
