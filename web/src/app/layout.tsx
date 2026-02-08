import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Festival Pulse 🎛️ | Techno & Electronic Events in Costa Rica",
  description:
    "Discover upcoming techno, electronic, and underground music events in Costa Rica. Auto-updated daily.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        <nav className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎛️</span>
              <span className="font-bold text-xl tracking-tight">
                Festival Pulse
              </span>
            </a>
            <div className="flex gap-6 text-sm text-zinc-400">
              <a href="/" className="hover:text-white transition">
                Events
              </a>
              <a href="/artists" className="hover:text-white transition">
                Artists
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-zinc-800 px-6 py-6 mt-12">
          <div className="max-w-6xl mx-auto text-center text-xs text-zinc-600">
            Festival Pulse — Auto-updated daily from Resident Advisor & more.
            Built with 🌙 by Nyx.
          </div>
        </footer>
      </body>
    </html>
  );
}
