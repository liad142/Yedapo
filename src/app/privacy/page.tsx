import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - PodCatch",
  description: "PodCatch Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1">Last updated: March 7, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Account Information</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you create an account, we collect your email address and display name through our
              authentication provider (Supabase). We use this information to provide and personalize the Service.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Usage Data</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect anonymized usage analytics through PostHog, including pages visited, features used,
              and general interaction patterns. This data helps us improve the Service. You can opt out of
              analytics tracking through the cookie consent preferences.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Podcast Preferences</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We store your podcast subscriptions, saved episodes, and generated summaries to provide a
              personalized experience. This data is associated with your account.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Notification Data</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you connect Telegram or email notifications, we store the necessary identifiers
              (Telegram chat ID, email address) to deliver notifications.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Provide and maintain the Service</li>
            <li>Personalize your experience (subscriptions, saved content)</li>
            <li>Send notifications you have opted into</li>
            <li>Improve the Service through anonymized analytics</li>
            <li>Enforce rate limits and usage quotas</li>
            <li>Communicate important updates about the Service</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">3. Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use the following third-party services that may process your data:
          </p>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Supabase</span>
              <span className="text-muted-foreground">Authentication and database (user accounts, content storage)</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">PostHog</span>
              <span className="text-muted-foreground">Product analytics (anonymized usage data)</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Google Gemini</span>
              <span className="text-muted-foreground">AI model for generating summaries and insights</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Deepgram</span>
              <span className="text-muted-foreground">Speech-to-text transcription</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Resend</span>
              <span className="text-muted-foreground">Email delivery for notifications</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Upstash</span>
              <span className="text-muted-foreground">Redis caching for rate limiting</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">Vercel</span>
              <span className="text-muted-foreground">Hosting and performance monitoring</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">4. Cookies & Tracking</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use cookies and local storage for:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Essential:</strong> Authentication session, theme preference</li>
            <li><strong className="text-foreground">Analytics:</strong> PostHog tracking (can be opted out via cookie consent)</li>
            <li><strong className="text-foreground">Performance:</strong> Vercel Speed Insights</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can manage your cookie preferences at any time through the cookie consent banner or your browser settings.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We retain your account data for as long as your account is active. Generated summaries and
            transcripts are cached to improve performance for all users. You may request deletion of your
            account and associated data at any time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">6. Your Rights (GDPR & CCPA)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Depending on your location, you may have the following rights:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Access:</strong> Request a copy of your personal data</li>
            <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate data</li>
            <li><strong className="text-foreground">Deletion:</strong> Request deletion of your personal data</li>
            <li><strong className="text-foreground">Portability:</strong> Request your data in a portable format</li>
            <li><strong className="text-foreground">Opt-out:</strong> Opt out of analytics tracking and marketing</li>
            <li><strong className="text-foreground">Non-discrimination:</strong> Exercise your rights without penalty (CCPA)</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To exercise any of these rights, contact us through the channels listed on our{' '}
            <a href="/dmca" className="text-primary hover:underline">contact page</a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">7. Data Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal data,
            including encryption in transit (HTTPS), secure authentication, and access controls. However,
            no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">8. Children&apos;s Privacy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Service is not intended for children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with personal
            data, please contact us.
          </p>
        </section>

        <section className="space-y-4 pb-8">
          <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            by posting a notice on the Service. Your continued use after changes constitutes acceptance of
            the updated policy.
          </p>
        </section>
      </div>
    </div>
  );
}
