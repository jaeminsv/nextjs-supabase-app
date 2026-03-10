import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "KAIST SV 동문회",
  description: "KAIST 실리콘밸리 동문회 이벤트 관리",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/*
           * App shell wrapper — centers the app at mobile width.
           *
           * On mobile  : w-full, looks like a native app
           * On desktop : max-w-[430px] centered, gray backdrop outside
           *
           * This ensures consistent mobile-first UX across all screen sizes,
           * matching the target audience (smartphone-primary alumni).
           */}
          <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 sm:flex sm:justify-center">
            <div className="relative w-full bg-background sm:max-w-[430px] sm:shadow-xl sm:ring-1 sm:ring-border/30">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
