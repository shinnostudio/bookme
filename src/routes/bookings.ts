/**
 * Bookings Routes (Multi-tenant)
 * POST /api/u/:slug/bookings        - Create a booking (public)
 * GET  /api/dashboard/bookings      - List bookings (auth required)
 */
import { Env, BookingRequest } from '../types';
import { getUserBySlug, getSettings, insertBooking, getBookings } from '../services/db';
import { getCalendarEvents, createCalendarEvent } from '../services/calendar';
import { refreshAccessToken } from '../services/oauth';
import { decrypt } from '../services/crypto';
import { sendOwnerNotification, sendBookerConfirmation } from '../services/email';
import { formatDateInTz, formatTimeInTz } from '../utils/timezone';
import { jsonResponse } from '../index';

export const handleBookingsRoutes = {
  /** POST /api/u/:slug/bookings - Create a new booking (public) */
  async create(request: Request, slug: string, env: Env): Promise<Response> {
    const body = (await request.json()) as BookingRequest;

    if (!body.startTime || !body.endTime || !body.name || !body.email) {
      return jsonResponse({ success: false, message: '必要な項目を入力してください。' }, 400);
    }

    const user = await getUserBySlug(env.DB, slug);
    if (!user) {
      return jsonResponse({ success: false, message: 'ユーザーが見つかりません。' }, 404);
    }

    const settings = await getSettings(env.DB, user.id);
    if (!settings.calendarId) {
      return jsonResponse({ success: false, message: 'カレンダーが設定されていません。' }, 400);
    }

    const start = new Date(body.startTime);
    const end = new Date(body.endTime);

    if (start.getTime() < Date.now()) {
      return jsonResponse({ success: false, message: '過去の日時は予約できません。' }, 400);
    }

    // Get access token
    const refreshToken = await decrypt(user.refresh_token, env.ENCRYPTION_KEY);
    const accessToken = await refreshAccessToken(refreshToken, env);

    // Double-booking check
    const events = await getCalendarEvents(
      accessToken,
      settings.calendarId,
      start.toISOString(),
      end.toISOString()
    );

    if (events.length > 0) {
      return jsonResponse({
        success: false,
        message: 'このスロットは既に予約されています。別の時間をお選びください。',
      }, 409);
    }

    try {
      const tz = settings.timezone || 'Asia/Tokyo';

      const eventTitle = `予約: ${body.name}様`;
      const description = `■ 予約情報\nお名前: ${body.name}\nメールアドレス: ${body.email}\nメッセージ: ${body.message || ''}\n\n---\nBookMe で作成された予約です。`;

      const eventId = await createCalendarEvent(
        accessToken,
        settings.calendarId,
        eventTitle,
        description,
        start.toISOString(),
        end.toISOString(),
        tz
      );

      const dateFormatted = formatDateInTz(start, tz);
      const startTimeFormatted = formatTimeInTz(start, tz);
      const endTimeFormatted = formatTimeInTz(end, tz);

      await insertBooking(env.DB, user.id, {
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

      // Send emails
      if (settings.ownerEmail && env.RESEND_API_KEY) {
        try {
          await sendOwnerNotification(
            env.RESEND_API_KEY, settings,
            { name: body.name, email: body.email, message: body.message || '' },
            start.toISOString(), end.toISOString()
          );
        } catch (emailErr) {
          console.error('Owner notification failed:', emailErr);
        }

        try {
          await sendBookerConfirmation(
            env.RESEND_API_KEY, settings,
            { name: body.name, email: body.email },
            start.toISOString(), end.toISOString()
          );
        } catch (emailErr) {
          console.error('Booker confirmation failed:', emailErr);
        }
      }

      return jsonResponse({
        success: true,
        message: '予約が完了しました、メールをご確認ください。',
      });
    } catch (error) {
      console.error('Booking creation error:', error);
      return jsonResponse({
        success: false,
        message: '予約の作成中にエラーが発生しました。しばらく後にもう一度お試しください。',
      }, 500);
    }
  },

  /** GET /api/dashboard/bookings - List bookings for current user */
  async list(userId: number, env: Env): Promise<Response> {
    const bookings = await getBookings(env.DB, userId);

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
