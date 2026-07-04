import { AttendanceStatus } from '../types';

/** Snapshot of another staff member's write, captured from a 409 response. */
export interface SyncNoticeDetails {
  status: AttendanceStatus;
  markedAt: string | null;
  updatedAt: string;
}

function formatUpdatedTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

function statusLabel(status: AttendanceStatus): string {
  return status === 'attended' ? 'present' : 'absent';
}

/**
 * Inline copy shown when another staff member's write wins a 409 conflict.
 * Uses the other staff member's status from the conflict snapshot — not the
 * row's current status, which may already reflect this staff member's retry.
 * Prefers markedAt (check-in time) and falls back to updatedAt so absent
 * rows still show when the change happened.
 */
export function formatSyncNotice(details: SyncNoticeDetails): string {
  const timestamp = details.markedAt ?? details.updatedAt;
  const label = statusLabel(details.status);

  if (timestamp) {
    return `Previously updated at ${formatUpdatedTime(timestamp)} by another staff to ${label}`;
  }

  return `Previously updated by another staff to ${label}`;
}
