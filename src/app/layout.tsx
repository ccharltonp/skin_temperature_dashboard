import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COSMOS-UK Skin Temperature Dashboard",
  description:
    "Near-real-time land surface skin temperature estimates at COSMOS-UK sites using the Stefan-Boltzmann longwave inversion method.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-stone-50 text-stone-800">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
