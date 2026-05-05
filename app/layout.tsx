import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Topbar } from '@/components/layout/Topbar';
import { Providers } from '@/components/layout/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinWise — Personal Finance Planner',
  description: 'Build a clear, actionable financial plan in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground">
        <Providers>
          <div className="flex h-full">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#e4eeef]/70 via-[#dce9eb]/70 to-[#d5e5e9]/80 p-6 pb-24 md:pb-6">
                {children}
              </main>
            </div>
          </div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
