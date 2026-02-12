import type { Metadata } from "next";
import "@/app/globals.css";

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
      <body className="bg-slate-50 min-h-screen">{children}</body>
    </html>
  );
};

export default RootLayout;
