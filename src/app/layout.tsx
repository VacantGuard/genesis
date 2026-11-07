import type { Metadata } from "next";
import { Fraunces, Fredoka, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
});

export const metadata: Metadata = {
  title: "TigEats",
  description: "Weekly meal prep menu, order payment, and a staff terminal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${fraunces.variable} ${fredoka.variable} antialiased`}>{children}</body>
    </html>
  );
}
