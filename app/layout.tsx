import type { Metadata } from "next";
import { Kalam, Inter } from "next/font/google";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import "./globals.css";

const kalam = Kalam({
  variable: "--font-kalam-raw",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-inter-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Calfi",
  description: "Sistema de finanzas personales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${kalam.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
