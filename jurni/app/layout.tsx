import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GoogleMapsProvider from "./components/GoogleMapsProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jurni",
  description: "Your travel companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleMapsProvider>
          {children}
        </GoogleMapsProvider>
      </body>
    </html>
  );
}
