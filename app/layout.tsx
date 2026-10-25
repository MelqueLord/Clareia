import type { Metadata } from "next";
import "./globals.css";
import "./intelligence.css";
import "./onboarding.css";
import "./landing.css";
import "./trial.css";
import "./privacy.css";
import "./support.css";

export const metadata: Metadata = {
  title: "Clareia · Seu assistente financeiro inteligente",
  description: "Registre receitas e despesas por áudio ou texto, acompanhe seu mês e receba orientações com base nos dados da sua vida pessoal ou do MEI.",
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
