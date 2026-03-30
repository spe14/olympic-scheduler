import type { Metadata, Viewport } from "next";
import { DM_Sans, Pacifico } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pacifico",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Collaboly",
  description: "Collaboratively plan your LA 2028 Olympic experience!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.className} ${pacifico.variable} overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
