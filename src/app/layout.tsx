import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fish",
  description: "Play Fish, the six-player team card game, in real time with friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}