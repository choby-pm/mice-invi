import type { Metadata } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const pretendard = localFont({ src: "./fonts/PretendardVariable.woff2", variable: "--font-pretendard", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "초청자 관리 솔루션",
  description: "MICE 행사 해외 VIP 초청자 관리 솔루션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
