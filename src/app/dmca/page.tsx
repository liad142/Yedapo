import type { Metadata } from "next";
import { Mail, Clock, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "DMCA & Takedown Policy - PodCatch",
  description: "PodCatch DMCA and content takedown policy for content creators",
};

export default function DMCAPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">DMCA & Takedown Policy</h1>
          <p className="text-muted-foreground mt-1">Last updated: March 7, 2026</p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            PodCatch respects the intellectual property rights of content creators. If you believe your
            content is being used in a way that infringes your copyright, we provide a straightforward
            process for requesting removal.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">How PodCatch Uses Content</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PodCatch generates AI-powered summaries, highlights, and analyses of publicly available
            podcast episodes and videos. Our AI creates transformative, original commentary designed to
            help listeners discover and preview content. We do not re-host, redistribute, or stream
            original audio or video files.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Filing a Takedown Request</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you are a copyright owner or authorized agent and wish to have content removed from
            PodCatch, please submit a notice containing the following information:
          </p>

          <div className="rounded-lg border p-4 space-y-3">
            <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Identification of the copyrighted work</strong> you
                believe is being infringed (e.g., podcast name, episode title, URL of original content).
              </li>
              <li>
                <strong className="text-foreground">Identification of the material on PodCatch</strong> that
                you claim is infringing (e.g., the episode page URL on PodCatch, or the specific
                summary/transcript content).
              </li>
              <li>
                <strong className="text-foreground">Your contact information</strong> including name,
                email address, and phone number.
              </li>
              <li>
                A statement that you have a <strong className="text-foreground">good faith belief</strong> that
                the use of the material is not authorized by the copyright owner, its agent, or the law.
              </li>
              <li>
                A statement, under <strong className="text-foreground">penalty of perjury</strong>, that the
                information in the notice is accurate and that you are the copyright owner or authorized to
                act on behalf of the owner.
              </li>
              <li>
                Your <strong className="text-foreground">physical or electronic signature</strong>.
              </li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">How to Submit</h2>
          <div className="grid gap-3">
            <div className="rounded-lg border p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">
                  Send your DMCA notice to: <strong className="text-foreground">dmca@podcatch.app</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Response Timeline</h2>
          <div className="grid gap-3">
            <div className="rounded-lg border p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Acknowledgment:</strong> Within 2 business days of receiving your notice.</p>
                <p><strong className="text-foreground">Action:</strong> Content will be removed or disabled within 5 business days of a valid notice.</p>
                <p><strong className="text-foreground">Notification:</strong> We will inform the affected user (if applicable) of the takedown.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Counter-Notice</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you believe your content was removed in error, you may file a counter-notice containing:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Your name, address, and contact information</li>
            <li>Identification of the material that was removed</li>
            <li>A statement under penalty of perjury that the material was removed by mistake or misidentification</li>
            <li>Consent to jurisdiction of your local federal court</li>
            <li>Your physical or electronic signature</li>
          </ul>
        </section>

        <section className="space-y-4 pb-8">
          <h2 className="text-xl font-semibold text-foreground">Content Creator Opt-Out</h2>
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you are a podcast creator and would like your show excluded from PodCatch entirely,
                you can contact us at <strong className="text-foreground">dmca@podcatch.app</strong> with
                your show details. We will add your show to our exclusion list within 5 business days.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
