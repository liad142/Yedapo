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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yedapo.com';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Yedapo',
  alternateName: ['Yedapo AI', 'yedapo'],
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: 'AI-powered insights from podcasts and YouTube — know what matters',
  // TODO: Add social profiles once claimed — strong signal to Google that Yedapo is a real brand.
  // sameAs: [
  //   'https://twitter.com/yedapo',
  //   'https://www.linkedin.com/company/yedapo',
  //   'https://www.instagram.com/yedapo',
  // ],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Yedapo',
  alternateName: 'Yedapo AI',
  url: SITE_URL,
  description: 'AI-powered insights from podcasts and YouTube — know what matters',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
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
