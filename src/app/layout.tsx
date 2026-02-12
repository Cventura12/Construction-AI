import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HammerVoice",
  description: "Voice-to-report pipeline for construction superintendents",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;

