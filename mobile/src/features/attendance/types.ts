export type AttendanceStatus = 'attended' | 'not_attended';

export interface Member {
  id: number;
  name: string;
}

export interface Attendee {
  id: number;
  member: Member;
  status: AttendanceStatus;
  version: number;
  markedAt: string | null;
}

/**
 * Static class metadata for the header (name, time, duration, trainer).
 *
 * The backend has no endpoint that returns this today (see README), so it is
 * placeholder content configured per class ID rather than live data.
 */
export interface ClassInfo {
  name: string;
  time: string;
  durationMinutes: number;
  trainerName: string;
}
