/**
 * Email Service using Resend API
 */
import { Settings } from '../types';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
}

/** Send an email via Resend */
async function sendEmail(apiKey: string, options: EmailOptions): Promise<void> {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BookMe <onboarding@resend.dev>',
      to: options.to,
      subject: options.subject,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Resend API error: ${response.status} ${errorText}`);
    throw new Error(`Resend API error: ${response.status} ${errorText}`);
  } else {
    console.log(`Email sent successfully to: ${options.to}`);
  }
}

/** Format a Date as a localized Japanese string */
function formatDateJP(isoStr: string, tz: string): string {
  const date = new Date(isoStr);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayIdx = dayMap[dayOfWeek] ?? 0;

  return `${year}年${month}月${day}日（${dayNames[dayIdx]}）`;
}

/** Format time in timezone */
function formatTimeInTz(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleTimeString('ja-JP', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Send booking notification to the calendar owner */
export async function sendOwnerNotification(
  apiKey: string,
  settings: Settings,
  booking: { name: string; email: string; message: string },
  startIso: string,
  endIso: string
): Promise<void> {
  const tz = settings.timezone || 'Asia/Tokyo';
  const dateStr = formatDateJP(startIso, tz);
  const startStr = formatTimeInTz(startIso, tz);
  const endStr = formatTimeInTz(endIso, tz);

  const subject = `[BookMe] 新しい予約: ${booking.name}様 - ${dateStr} ${startStr}`;

  const body = `${settings.ownerName}様

新しい予約が入りました。

━━━━━━━━━━━━━━━━━━━━
■ 予約情報
━━━━━━━━━━━━━━━━━━━━
日時: ${dateStr} ${startStr} - ${endStr}
お名前: ${booking.name}
メール: ${booking.email}
メッセージ:
${booking.message || '(なし)'}
━━━━━━━━━━━━━━━━━━━━

Google カレンダーに自動で登録されています。

---
BookMe - オンライン予約システム`;

  await sendEmail(apiKey, {
    to: settings.ownerEmail,
    subject,
    text: body,
  });
}

/** Send booking confirmation to the person who booked */
export async function sendBookerConfirmation(
  apiKey: string,
  settings: Settings,
  booking: { name: string; email: string },
  startIso: string,
  endIso: string
): Promise<void> {
  const tz = settings.timezone || 'Asia/Tokyo';
  const dateStr = formatDateJP(startIso, tz);
  const startStr = formatTimeInTz(startIso, tz);
  const endStr = formatTimeInTz(endIso, tz);

  const subject = `予約確認 - ${settings.ownerName}とのアポイントメント`;

  const body = `${booking.name}様

ご予約ありがとうございます。
以下の内容で予約を承りました。

━━━━━━━━━━━━━━━━━━━━
■ 予約情報
━━━━━━━━━━━━━━━━━━━━
日時: ${dateStr} ${startStr} - ${endStr}
相手: ${settings.ownerName}
━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、お気軽にご連絡ください。

---
BookMe - オンライン予約システム`;

  await sendEmail(apiKey, {
    to: booking.email,
    subject,
    text: body,
  });
}
