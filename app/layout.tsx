import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cue",
  description: "A quiet meeting assistant that appears when you are called.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
