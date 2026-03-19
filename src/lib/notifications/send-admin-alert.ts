import { createLogger } from '@/lib/logger';

const log = createLogger('admin-alert');

export async function sendAdminAlert(subject: string, details: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    log.warn('Admin alert not configured', { subject });
    return;
  }
  const text = `*[Yedapo Alert]*\n*${subject}*\n\n${details}\n\n_${new Date().toISOString()}_`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    log.warn('Failed to send admin alert', { subject, error: err instanceof Error ? err.message : String(err) });
  }
}
