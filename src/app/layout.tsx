import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudSentry | Operator Console",
  description: "CloudSentry PS-03 multi-cloud cost intelligence. Stage 2 foundation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
