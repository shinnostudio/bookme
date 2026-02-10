/**
 * Bookings Routes
 * POST /api/bookings       - Create a booking
 * GET  /api/admin/bookings  - List all bookings (admin)
 */
import { Env, BookingRequest } from '../types';
import { getSettings, insertBooking, getBookings } from '../services/db';
import { getCalendarEvents, createCalendarEvent } from '../services/calendar';
import { sendOwnerNotification, sendBookerConfirmation } from '../services/email';
import { verifyAdmin } from '../utils/auth';
import { formatDateInTz, formatTimeInTz } from '../utils/timezone';
import { jsonResponse } from '../index';

export const handleBookingsRoutes = {
  /** POST /api/bookings - Create a new booking */
  async create(request: Request, env: Env): Promise<Response> {
    const body = (await request.json()) as BookingRequest;

    // Validate input
    if (!body.startTime || !body.endTime || !body.name || !body.email) {
      return jsonResponse(
        { success: false, message: '必要な項目を入力してください。' },
        400
      );
    }

    const settings = await getSettings(env.DB);

    if (!settings.calendarId) {
      return jsonResponse(
        { success: false, message: 'カレンダーが設定されていません。' },
        400
      );
    }

    const start = new Date(body.startTime);
    const end = new Date(body.endTime);

    // Check for past dates
    if (start.getTime() < Date.now()) {
      return jsonResponse(
        { success: false, message: '過去の日時は予約できません。' },
        400
      );
    }

    // Double-booking check: fetch events in the time range
    const events = await getCalendarEvents(
      env.GOOGLE_SERVICE_ACCOUNT_JSON,
      settings.calendarId,
      start.toISOString(),
      end.toISOString()
    );

    if (events.length > 0) {
      return jsonResponse(
        {
          success: false,
          message: 'このスロットは既に予約されています。別の時間をお選びください。',
        },
        409
      );
    }

    try {
      const tz = settings.timezone || 'Asia/Tokyo';

      // Create calendar event
      const eventTitle = `予約: ${body.name}様`;
      const description = `■ 予約情報
お名前: ${body.name}
メールアドレス: ${body.email}
メッセージ: ${body.message || ''}

---
BookMe で作成された予約です。`;

      const eventId = await createCalendarEvent(
        env.GOOGLE_SERVICE_ACCOUNT_JSON,
        settings.calendarId,
        eventTitle,
        description,
        start.toISOString(),
        end.toISOString(),
        tz
      );

      // Save to D1
      const dateFormatted = formatDateInTz(start, tz);
      const startTimeFormatted = formatTimeInTz(start, tz);
      const endTimeFormatted = formatTimeInTz(end, tz);

      await insertBooking(env.DB, {
        date: dateFormatted,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        name: body.name,
        email: body.email,
        message: body.message || '',
        eventId,
      });

      // Send notification emails
      if (settings.ownerEmail && env.RESEND_API_KEY) {
        try {
          await sendOwnerNotification(
            env.RESEND_API_KEY,
            settings,
            { name: body.name, email: body.email, message: body.message || '' },
            start.toISOString(),
            end.toISOString()
          );
          console.log('Owner notification sent to:', settings.ownerEmail);
        } catch (emailErr) {
          console.error('Owner notification failed:', emailErr);
        }

        try {
          await sendBookerConfirmation(
            env.RESEND_API_KEY,
            settings,
            { name: body.name, email: body.email },
            start.toISOString(),
            end.toISOString()
          );
          console.log('Booker confirmation sent to:', body.email);
        } catch (emailErr) {
          console.error('Booker confirmation failed:', emailErr);
        }
      } else {
        console.log('Email skipped: ownerEmail=' + settings.ownerEmail + ', hasApiKey=' + !!env.RESEND_API_KEY);
      }

      return jsonResponse({
        success: true,
        message: '予約が完了しました！確認メールを送信しました。',
      });
    } catch (error) {
      console.error('Booking creation error:', error);
      return jsonResponse(
        {
          success: false,
          message: '予約の作成中にエラーが発生しました。しばらく後にもう一度お試しください。',
        },
        500
      );
    }
  },

  /** GET /api/admin/bookings - List all bookings (admin auth required) */
  async list(request: Request, env: Env): Promise<Response> {
    if (!verifyAdmin(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const bookings = await getBookings(env.DB);

    // Map to client-friendly format
    const result = bookings.map((b) => ({
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      name: b.name,
      email: b.email,
      message: b.message || '',
      bookedAt: b.created_at,
      eventId: b.event_id || '',
    }));

    return jsonResponse(result);
  },
};
