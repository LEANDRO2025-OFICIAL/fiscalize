import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiscalize",
  description: "Gestão e fiscalização de contratos públicos com evidências auditáveis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
