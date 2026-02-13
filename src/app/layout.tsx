import "./globals.css";

export const metadata = {
  title: "Hammervoice",
  description: "Field console for daily logs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {/* App background */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(59,130,246,0.14),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(1000px_circle_at_50%_90%,rgba(244,63,94,0.08),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_30%,rgba(0,0,0,0.25))]" />
        </div>

        {/* Content */}
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
