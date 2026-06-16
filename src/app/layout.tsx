import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Cuevita CRM",
  description: "CRM and WhatsApp lead dashboard for La Cuevita Furniture"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

