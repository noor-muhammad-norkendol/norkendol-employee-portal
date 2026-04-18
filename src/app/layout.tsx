import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import QueryProvider from "@/components/QueryProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal",
  description: "Employee Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('portal-theme');
              if (t === 'light' || t === 'dark') {
                document.documentElement.setAttribute('data-theme', t);
              }
              var c = localStorage.getItem('portal-custom-colors');
              if (c) {
                var colors = JSON.parse(c);
                var r = document.documentElement.style;
                if (colors.accent) { r.setProperty('--accent', colors.accent); r.setProperty('--accent-hover', colors.accent); }
                if (colors.sidebarBg) r.setProperty('--bg-secondary', colors.sidebarBg);
                if (colors.pageBg) r.setProperty('--bg-primary', colors.pageBg);
                if (colors.cardBg) r.setProperty('--bg-surface', colors.cardBg);
                if (colors.textPrimary) r.setProperty('--text-primary', colors.textPrimary);
                if (colors.textSecondary) r.setProperty('--text-secondary', colors.textSecondary);
                if (colors.borderColor) r.setProperty('--border-color', colors.borderColor);
              }
            } catch(e) {}
          })();
        ` }} />
      </head>
      <body className="h-full"><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
