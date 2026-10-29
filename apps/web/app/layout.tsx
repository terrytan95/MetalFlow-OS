import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MetalFlow OS",
  description:
    "The intelligent operating system for metal supply & interior projects",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
