import { getApiBaseUrl } from '../../../config/env';
import { Attendee, AttendanceStatus } from '../types';

/** Raw shapes returned by the backend, before mapping to our camelCase types. */
interface RawMember {
  id: number;
  name: string;
}

interface RawAttendee {
  id: number;
  member: RawMember;
  status: AttendanceStatus;
  version: number;
  marked_at: string | null;
  updated_at: string;
}

interface RawAttendeeCollectionResponse {
  data: RawAttendee[];
}

interface RawAttendeeResponse {
  data: RawAttendee;
}

interface RawBulkUpdateResponse {
  updated: number;
  status: AttendanceStatus;
}

interface RawConflictResponse {
  message: string;
  data: RawAttendee;
}

function toAttendee(raw: RawAttendee): Attendee {
  return {
    id: raw.id,
    member: raw.member,
    status: raw.status,
    version: raw.version,
    markedAt: raw.marked_at,
    updatedAt: raw.updated_at,
  };
}

/** Generic API failure (network error, 404, 422, ...). */
export class AttendanceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AttendanceApiError';
  }
}

/**
 * The single-update endpoint returned 409: another staff member already
 * updated this row. `fresh` is the attendee's current true state, as
 * returned by the backend, so the caller can reconcile instead of retrying
 * blindly against a stale version.
 */
export class AttendanceConflictError extends AttendanceApiError {
  constructor(public readonly fresh: Attendee) {
    super('This attendee was already updated elsewhere.', 409);
    this.name = 'AttendanceConflictError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new AttendanceApiError(
      `Couldn't reach the server at ${apiBaseUrl}. On a physical device, start the backend with "php artisan serve --host=0.0.0.0 --port=8000" and allow port 8000 through Windows Firewall.`,
    );
  }

  if (response.status === 409) {
    const body = (await response.json()) as RawConflictResponse;
    throw new AttendanceConflictError(toAttendee(body.data));
  }

  if (!response.ok) {
    const message =
      response.status === 404
        ? 'This attendee is not enrolled in this class.'
        : `Request failed (${response.status}).`;
    throw new AttendanceApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function getAttendees(classId: number): Promise<Attendee[]> {
  const body = await request<RawAttendeeCollectionResponse>(`/classes/${classId}/attendees`);
  return body.data.map(toAttendee);
}

export async function updateAttendance(
  classId: number,
  memberId: number,
  status: AttendanceStatus,
  version: number,
): Promise<Attendee> {
  const body = await request<RawAttendeeResponse>(`/classes/${classId}/attendees/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, version }),
  });
  return toAttendee(body.data);
}

export async function markAllAttendance(
  classId: number,
  status: AttendanceStatus,
): Promise<RawBulkUpdateResponse> {
  return request<RawBulkUpdateResponse>(`/classes/${classId}/attendees`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
