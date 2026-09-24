import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { APP_NAME } from "@heft/shared";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${APP_NAME} Admin`,
  description: `Operations console for ${APP_NAME} bulky-item delivery.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${jakarta.variable} min-h-screen bg-paper text-charcoal antialiased`}>{children}</body>
    </html>
  );
}
