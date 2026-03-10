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
 * Retries once with a 2s delay on 5xx / transient errors.
 */
export async function sendSummaryEmail(
  to: string,
  content: ShareContent
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await getResend().emails.send({
        from: 'Yedapo <notifications@yedapo.com>',
        to,
        subject: `${content.episodeTitle} - Summary Ready`,
        react: SummaryReadyEmail(content),
      });

      if (error) {
        // If it looks like a server error and this is the first attempt, retry
        if (attempt === 0 && error.message?.includes('5')) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed';
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { success: false, error: message };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}
