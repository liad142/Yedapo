/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  images: {
    remotePatterns: [
      // Apple / iTunes
      { protocol: "https", hostname: "**.mzstatic.com" },
      // YouTube
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      // Spotify
      { protocol: "https", hostname: "**.scdn.co" },
      // Podcast Index
      { protocol: "https", hostname: "**.podcastindex.org" },
      // Google
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
      // Common podcast hosting CDNs (RSS feed artwork)
      { protocol: "https", hostname: "**.simplecastcdn.com" },
      { protocol: "https", hostname: "**.megaphone.fm" },
      { protocol: "https", hostname: "**.omnycontent.com" },
      { protocol: "https", hostname: "**.buzzsprout.com" },
      { protocol: "https", hostname: "**.libsyn.com" },
      { protocol: "https", hostname: "**.podbean.com" },
      { protocol: "https", hostname: "**.transistor.fm" },
      { protocol: "https", hostname: "**.transistorcdn.com" },
      { protocol: "https", hostname: "**.anchor.fm" },
      { protocol: "https", hostname: "**.spreaker.com" },
      { protocol: "https", hostname: "**.art19.com" },
      { protocol: "https", hostname: "**.acast.com" },
      { protocol: "https", hostname: "**.captivate.fm" },
      { protocol: "https", hostname: "**.blubrry.com" },
      { protocol: "https", hostname: "**.podtrac.com" },
      { protocol: "https", hostname: "**.soundcloud.com" },
      { protocol: "https", hostname: "**.redcircle.com" },
      { protocol: "https", hostname: "**.theringer.com" },
      { protocol: "https", hostname: "**.podigee.com" },
      { protocol: "https", hostname: "**.whooshkaa.com" },
      { protocol: "https", hostname: "**.squarespace.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "**.wordpress.com" },
      { protocol: "https", hostname: "**.brightspotcdn.com" },
      { protocol: "https", hostname: "**.pod.co" },
    ],
  },
  async headers() {
    const scriptSrc = `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com https://us-assets.i.posthog.com https://www.youtube.com`;
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "media-src *",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://*.upstash.io https://va.vercel-scripts.com https://vitals.vercel-insights.com https://us.i.posthog.com https://us-assets.i.posthog.com",
              "font-src 'self' data:",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
            ].join("; "),
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
