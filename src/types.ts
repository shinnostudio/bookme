/** Cloudflare Workers environment bindings */
export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  RESEND_API_KEY: string;
  BASE_URL: string;
}

/** User record from DB */
export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  slug: string;
  avatar_url: string;
  refresh_token: string;
  created_at: string;
}

/** Settings stored in D1 (per user) */
export interface Settings {
  ownerName: string;
  ownerEmail: string;
  calendarId: string;
  duration: number;
  startHour: number;
  endHour: number;
  timezone: string;
  maxDays: number;
  availableDays: number[];
}

/** Public-facing settings (no secrets) */
export interface PublicSettings {
  ownerName: string;
  duration: number;
  startHour: number;
  endHour: number;
  timezone: string;
  maxDays: number;
  availableDays: number[];
  slug: string;
}

/** Calendar event from Google Calendar API */
export interface CalendarEvent {
  start: string;
  end: string;
  isAllDay: boolean;
}

/** Time slot for a day */
export interface TimeSlot {
  start: string;
  end: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  available: boolean;
  isPast: boolean;
  isBusy: boolean;
}

/** Booking request from client */
export interface BookingRequest {
  startTime: string;
  endTime: string;
  name: string;
  email: string;
  message?: string;
}

/** Booking record from DB */
export interface BookingRecord {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  start_iso: string;
  end_iso: string;
  name: string;
  email: string;
  message: string;
  event_id: string;
  created_at: string;
}

/** JWT Session payload */
export interface SessionPayload {
  userId: number;
  email: string;
  exp: number;
}

/** Google OAuth token response */
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

/** Google user profile from ID token */
export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}
