import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy - Yedapo",
  description: "Yedapo Refund Policy",
};

export default function RefundPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Refund Policy</h1>
          <p className="text-muted-foreground mt-1">Last updated: April 9, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">1. Free Plan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Yedapo Free plan costs nothing and requires no payment information. There is nothing to refund.
            You can use the Free plan indefinitely with no obligation to upgrade.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">2. Pro Plan Subscriptions</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yedapo Pro is a recurring subscription billed monthly ($12.99/month) or annually ($103.99/year).
            Your subscription renews automatically at the end of each billing period unless you cancel.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">3. Cancellation</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can cancel your Pro subscription at any time from your{" "}
            <Link href="/settings" className="text-primary hover:underline">account settings</Link>.
            When you cancel:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-2 pl-2">
            <li>You will retain access to Pro features until the end of your current billing period.</li>
            <li>Your account will automatically revert to the Free plan when the billing period ends.</li>
            <li>No further charges will be made after cancellation.</li>
            <li>Your data, summaries, and preferences are preserved on the Free plan.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">4. Refund Eligibility</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We want you to be satisfied with Yedapo Pro. If you are not happy with the service, refunds are
            available under the following conditions:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-2 pl-2">
            <li>
              <strong className="text-foreground">Within 7 days of first purchase:</strong> If you subscribe to
              Pro for the first time and are not satisfied, you may request a full refund within 7 days of your
              initial payment. No questions asked.
            </li>
            <li>
              <strong className="text-foreground">Service outages:</strong> If Yedapo experiences significant
              downtime (more than 48 consecutive hours) during your billing period, you may request a prorated
              refund for the affected period.
            </li>
            <li>
              <strong className="text-foreground">Billing errors:</strong> If you were charged incorrectly
              (e.g., double-charged, charged after cancellation), we will issue a full refund for the erroneous charge.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">5. Non-Refundable Situations</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Refunds are generally not provided in the following cases:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-2 pl-2">
            <li>Requests made more than 7 days after the initial purchase (for first-time subscribers).</li>
            <li>Renewal charges on existing subscriptions (cancel before the renewal date to avoid charges).</li>
            <li>Partial-month usage — we do not prorate refunds for unused days within a billing cycle, except in cases of service outages.</li>
            <li>Dissatisfaction with AI-generated content quality — AI summaries may vary in accuracy and completeness, as noted in our <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">6. How to Request a Refund</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To request a refund, please contact us at{" "}
            <a href="mailto:support@yedapo.com" className="text-primary hover:underline">support@yedapo.com</a>{" "}
            with the following information:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-2 pl-2">
            <li>Your account email address</li>
            <li>Date of the charge</li>
            <li>Reason for the refund request</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We aim to process all refund requests within 5 business days. Approved refunds will be returned to
            the original payment method and may take an additional 5-10 business days to appear on your statement,
            depending on your bank or card issuer.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">7. Annual Plan Refunds</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Annual subscriptions are eligible for a full refund within 7 days of the initial purchase.
            After 7 days, you may cancel at any time and retain access through the end of your annual
            billing period, but no partial refund will be issued for the remaining months.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">8. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Refund Policy from time to time. Any changes will be posted on this page
            with an updated revision date. Your continued use of the Service after changes are posted
            constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">9. Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you have questions about this Refund Policy, please contact us at{" "}
            <a href="mailto:support@yedapo.com" className="text-primary hover:underline">support@yedapo.com</a>.
          </p>
        </section>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            See also: <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
            and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
