/** Cloudflare Workers environment bindings */
export interface Env {
  DB: D1Database;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  RESEND_API_KEY: string;
  ADMIN_PASSWORD: string;
}

/** Settings stored in D1 */
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

/** Google Service Account key JSON structure */
export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

/** JWT header/payload for Google auth */
export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface JWTClaims {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}
