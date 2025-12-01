import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MUCHI NOTE",
  description: "Month-based note board with drag and search",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
