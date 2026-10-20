import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const fontBody = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Home Base",
  description: "A shared home base for two.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
