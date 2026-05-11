import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Produtividade Ressuprimento',
  description: 'Sistema profissional de análise operacional logística para o setor de ressuprimento.',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-dark-900 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
