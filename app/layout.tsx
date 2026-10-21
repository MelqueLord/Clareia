import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clareia · Finanças no rumo certo",
  description: "Seu dinheiro, com direção. Controle pessoal e MEI com projeções e alertas explicados.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clareia" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
