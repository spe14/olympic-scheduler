import type { Metadata } from "next";
import { DM_Sans, Pacifico } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pacifico",
});

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
      <body className={`${dmSans.className} ${pacifico.variable}`}>
        {children}
      </body>
    </html>
  );
}
