import type { Metadata } from "next";
import "./globals.css";
import "./intelligence.css";
import "./onboarding.css";
import "./landing.css";
import "./trial.css";
import "./privacy.css";
import "./support.css";

export const metadata: Metadata = {
  title: "Clareia · Organize suas finanças por áudio e com inteligência",
  description: "Fale suas receitas e despesas, acompanhe seus gastos e receba orientação financeira para sua vida pessoal ou seu MEI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clareia" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
