import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import { Header } from "@/components/layout/header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Meeting Assistant",
  description: "Record, transcribe, and summarize your meetings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 font-sans">
        <LanguageProvider>
          <Header />
          <main className="flex-1">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
