import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olympic Scheduler",
  description: "Plan your LA 2028 Olympics attendance with friends",
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
