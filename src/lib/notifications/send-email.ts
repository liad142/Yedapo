import { Resend } from 'resend';
import { SummaryReadyEmail } from '@/emails/summary-ready';
import type { ShareContent } from '@/types/notifications';

let resend: Resend;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Send a summary-ready email via Resend with the React Email template.
 */
export async function sendSummaryEmail(
  to: string,
  content: ShareContent
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getResend().emails.send({
      from: 'Sumfi <notifications@podcatch.com>',
      to,
      subject: `${content.episodeTitle} - Summary Ready`,
      react: SummaryReadyEmail(content),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return { success: false, error: message };
  }
}
