import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Yedapo",
  description: "Yedapo Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1">Last updated: March 28, 2026</p>
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
          <h2 className="text-xl font-semibold text-foreground">3. Legal Basis for Processing (GDPR)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you are located in the European Economic Area (EEA), we process your personal data under the
            following legal bases:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Contract:</strong> Account creation and service delivery — processing is necessary to provide the Service you have requested.</li>
            <li><strong className="text-foreground">Consent:</strong> Analytics cookies and newsletter — we process this data based on your explicit opt-in consent, which you can withdraw at any time.</li>
            <li><strong className="text-foreground">Legitimate Interest:</strong> Security, fraud prevention, and service improvement — we have a legitimate interest in keeping the Service secure and improving user experience.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">4. Third-Party Services</h2>
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
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="font-medium text-foreground">YouTube Data API</span>
              <span className="text-muted-foreground">YouTube subscriptions and content metadata via Google API</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These third-party services are subject to their own privacy policies. Please review the{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">YouTube Terms of Service</a>{' '}
            and{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Privacy Policy</a>{' '}
            for information about how Google handles your data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">5. YouTube API Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When you connect your Google account, we access your YouTube subscriptions via the YouTube Data API.
            We store your OAuth tokens securely to maintain the connection. You can disconnect YouTube at any time
            from Settings, which will delete your stored tokens and YouTube data. Our use of YouTube API data
            complies with the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>,
            including the Limited Use requirements.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">6. Cookies & Tracking</h2>
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
          <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We retain your account data for as long as your account is active. Generated summaries and
            transcripts are cached to improve performance for all users. You may request deletion of your
            account and associated data at any time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">8. Your Rights (GDPR & CCPA)</h2>
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
            <Link href="/dmca" className="text-primary hover:underline">contact page</Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">9. Data Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal data,
            including encryption in transit (HTTPS), secure authentication, and access controls. However,
            no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">10. Children&apos;s Privacy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Service is not intended for children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with personal
            data, please contact us.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">11. International Data Transfers</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data may be transferred to and processed in the United States and other countries where our
            service providers operate (Supabase, Vercel, Google, PostHog). We rely on Standard Contractual
            Clauses (SCCs) and other appropriate safeguards for these transfers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">12. Data Breach Notification</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In the event of a data breach affecting your personal data, we will notify affected users within
            72 hours as required by GDPR, and notify the relevant supervisory authority.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">13. Right to Lodge Complaint</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            EU residents have the right to lodge a complaint with their local data protection supervisory authority
            if you believe your personal data has been processed in violation of applicable data protection law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">14. California Residents (CCPA)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not sell your personal information. Under the California Consumer Privacy Act (CCPA), you have
            the right to know what personal data we collect, request deletion, and opt out of any future sale.
            To exercise these rights, contact us at{' '}
            <a href="mailto:privacy@yedapo.com" className="text-primary hover:underline">privacy@yedapo.com</a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">15. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            by posting a notice on the Service. Your continued use after changes constitutes acceptance of
            the updated policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">16. Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For questions about this Privacy Policy, contact us at{' '}
            <a href="mailto:privacy@yedapo.com" className="text-primary hover:underline">privacy@yedapo.com</a>.
          </p>
        </section>

        <div className="pt-4 border-t border-border pb-8">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Yedapo</p>
            <p>Tel Aviv, Israel</p>
            <p>
              <a href="mailto:privacy@yedapo.com" className="text-primary hover:underline">privacy@yedapo.com</a>
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            See also: <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
            and <Link href="/refund" className="text-primary hover:underline">Refund Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
