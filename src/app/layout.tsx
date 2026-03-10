import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CountryProvider } from "@/contexts/CountryContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UsageProvider } from "@/contexts/UsageContext";
import { SummarizeQueueProvider } from "@/contexts/SummarizeQueueContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { AppShell } from "@/components/AppShell";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Yedapo \u2014 Know what matters",
  description: "AI-powered insights from podcasts and YouTube \u2014 know what matters",
  openGraph: {
    title: 'Yedapo',
    description: 'AI-powered insights from podcasts and YouTube',
    type: 'website',
    siteName: 'Yedapo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yedapo',
    description: 'AI-powered insights from podcasts and YouTube',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${plusJakarta.variable}`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
          Skip to content
        </a>
        <AuthProvider>
          <PostHogProvider>
            <ThemeProvider>
              <CountryProvider>
                <UsageProvider>
                <SummarizeQueueProvider>
                  <SubscriptionProvider>
                    <AudioPlayerProvider>
                      <AppShell>{children}</AppShell>
                      <SpeedInsights />
                    </AudioPlayerProvider>
                  </SubscriptionProvider>
                </SummarizeQueueProvider>
                </UsageProvider>
              </CountryProvider>
            </ThemeProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
