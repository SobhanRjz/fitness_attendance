import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../../../shared/alert';
import {
  AttendanceApiError,
  AttendanceConflictError,
  getAttendees,
  markAllAttendance,
  updateAttendance,
} from '../api/attendanceApi';
import { Attendee, AttendanceStatus } from '../types';
import { SyncNoticeDetails } from '../utils/formatSyncNotice';

export type AttendanceLoadStatus = 'loading' | 'success' | 'error';

export interface UseAttendanceResult {
  status: AttendanceLoadStatus;
  attendees: Attendee[];
  errorMessage: string | null;
  pendingMemberIds: ReadonlySet<number>;
  /** Other staff's write snapshot per row, shown after a 409 conflict. */
  syncNotices: ReadonlyMap<number, SyncNoticeDetails>;
  isMarkingAllPresent: boolean;
  isMarkingAllAbsent: boolean;
  isRefreshing: boolean;
  hasRosterUpdates: boolean;
  presentCount: number;
  totalCount: number;
  retry: () => void;
  refreshRoster: () => void;
  toggleAttendee: (memberId: number) => void;
  dismissSyncNotice: (memberId: number) => void;
  markAllPresent: () => void;
  markAllAbsent: () => void;
}

function oppositeStatus(status: AttendanceStatus): AttendanceStatus {
  return status === 'attended' ? 'not_attended' : 'attended';
}

function notifyRequestError(title: string, error: unknown): void {
  if (error instanceof AttendanceApiError && error.status === 429) {
    notify('Too many requests', error.message);
    return;
  }

  notify(title, error instanceof Error ? error.message : 'Please try again.');
}

/**
 * Owns the roster's data lifecycle: initial load (loading/success/error —
 * these three states drive the whole screen), optimistic per-row toggles
 * with rollback/conflict-reconciliation, the "mark all present"/"mark all
 * absent" bulk actions, and pull-to-refresh.
 */
export function useAttendance(classId: number): UseAttendanceResult {
  const [status, setStatus] = useState<AttendanceLoadStatus>('loading');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<number>>(new Set());
  const [markingAllStatus, setMarkingAllStatus] = useState<AttendanceStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // True once a background check has noticed that some *other* row changed
  // on the server since we last loaded it. We never apply that data
  // silently — see `checkForRosterUpdates` — the user pulls to refresh to
  // bring it in explicitly.
  const [hasRosterUpdates, setHasRosterUpdates] = useState(false);
  const [syncNotices, setSyncNotices] = useState<Map<number, SyncNoticeDetails>>(new Map());

  // Mirror `attendees`/`pendingMemberIds`, but readable synchronously (not
  // via a stale closure) from background callbacks like
  // `checkForRosterUpdates`, which run well after the render that scheduled
  // them.
  const attendeesRef = useRef<Attendee[]>([]);
  const pendingMemberIdsRef = useRef<Set<number>>(new Set());

  const applyAttendees = useCallback(
    (updater: Attendee[] | ((current: Attendee[]) => Attendee[])) => {
      setAttendees((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        attendeesRef.current = next;
        return next;
      });
    },
    [],
  );

  const clearSyncNotice = useCallback((memberId: number) => {
    setSyncNotices((current) => {
      if (!current.has(memberId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(memberId);
      return next;
    });
  }, []);

  const showSyncNotice = useCallback((memberId: number, details: SyncNoticeDetails) => {
    setSyncNotices((current) => new Map(current).set(memberId, details));
  }, []);

  const load = useCallback(() => {
    setStatus('loading');
    setErrorMessage(null);
    setHasRosterUpdates(false);
    setSyncNotices(new Map());

    getAttendees(classId)
      .then((data) => {
        applyAttendees(data);
        setStatus('success');
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
        setStatus('error');
      });
  }, [classId, applyAttendees]);

  useEffect(() => {
    load();
  }, [load]);

  const addPending = useCallback((memberId: number) => {
    setPendingMemberIds((current) => {
      const next = new Set(current).add(memberId);
      pendingMemberIdsRef.current = next;
      return next;
    });
  }, []);

  const removePending = useCallback((memberId: number) => {
    setPendingMemberIds((current) => {
      const next = new Set(current);
      next.delete(memberId);
      pendingMemberIdsRef.current = next;
      return next;
    });
  }, []);

  /**
   * After a single-row update, silently check whether any *other* row has
   * since changed on the server (e.g. another staff member updated it).
   *
   * This never applies the fetched data — it only flips `hasRosterUpdates`
   * so the screen can show a "new updates available" banner and let the
   * user decide when to pull to refresh, instead of rows jumping around
   * underneath them. `excludeMemberId` is the row this client just wrote
   * itself (already applied from the API response) and any row with a save
   * currently in flight is skipped too, since its local status doesn't
   * reflect the write yet.
   *
   * We compare attendance status rather than `version`: the version bumps
   * on every write, but what the user actually cares about is whether
   * someone else's change would flip a row's present/absent state on their
   * screen.
   */
  const checkForRosterUpdates = useCallback(
    (excludeMemberId: number): void => {
      getAttendees(classId)
        .then((data) => {
          const somethingElseChanged = data.some((fresh) => {
            if (fresh.member.id === excludeMemberId) {
              return false;
            }
            if (pendingMemberIdsRef.current.has(fresh.member.id)) {
              return false;
            }
            const local = attendeesRef.current.find((attendee) => attendee.member.id === fresh.member.id);
            return local === undefined || local.status !== fresh.status;
          });

          if (somethingElseChanged) {
            setHasRosterUpdates(true);
          }
        })
        .catch(() => {
          // Best-effort background check — staying quiet is safer than a false alarm.
        });
    },
    [classId],
  );

  /**
   * Pull-to-refresh: fetch the latest roster and apply it. Rows with a save
   * currently in flight keep their local (optimistic/reconciled) value
   * instead of being overwritten by a possibly-stale response, so this can
   * never stomp on a write that hasn't landed yet.
   */
  const refreshRoster = useCallback(() => {
    setIsRefreshing(true);

    getAttendees(classId)
      .then((data) => {
        applyAttendees((current) =>
          data.map((fresh) =>
            pendingMemberIdsRef.current.has(fresh.member.id)
              ? (current.find((attendee) => attendee.member.id === fresh.member.id) ?? fresh)
              : fresh,
          ),
        );
        setHasRosterUpdates(false);
        setSyncNotices(new Map());
      })
      .catch((error: unknown) => {
        notifyRequestError("Couldn't refresh", error);
      })
      .finally(() => setIsRefreshing(false));
  }, [classId, applyAttendees]);

  const toggleAttendee = useCallback(
    (memberId: number) => {
      if (pendingMemberIds.has(memberId)) {
        return; // A save is already in flight for this row.
      }

      clearSyncNotice(memberId);

      const previous = attendees.find((attendee) => attendee.member.id === memberId);
      if (!previous) {
        return;
      }
      const optimisticTarget = previous;
      const nextStatus = oppositeStatus(optimisticTarget.status);

      applyAttendees((current) =>
        current.map((attendee) =>
          attendee.member.id === memberId ? { ...attendee, status: nextStatus } : attendee,
        ),
      );
      addPending(memberId);

      updateAttendance(classId, memberId, nextStatus, optimisticTarget.version)
        .then((updated) => {
          // Apply the server-confirmed row immediately for responsiveness,
          // and free up this row for the next tap right away...
          applyAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? updated : attendee)),
          );
          removePending(memberId);

          // ...then silently check whether other rows changed elsewhere.
          // This single update only ever touches this one row — the client
          // never sends the whole stale roster back — so a 200 here tells
          // us nothing about the rest of the list.
          checkForRosterUpdates(memberId);
        })
        .catch((error: unknown) => {
          if (error instanceof AttendanceConflictError) {
            // Someone else already updated this row first — reconcile to the
            // server's version immediately and free the row up for the next
            // tap right away, instead of retrying against a stale version.
            // Only surface the inline hint when the server's status differs
            // from what this staff member intended: if it already matches,
            // their tap effectively "won" and nothing needs calling out.
            applyAttendees((current) =>
              current.map((attendee) => (attendee.member.id === memberId ? error.fresh : attendee)),
            );
            removePending(memberId);
            if (nextStatus !== error.fresh.status) {
              showSyncNotice(memberId, error.fresh);
            }
            checkForRosterUpdates(memberId);
            return;
          }

          // Any other failure: roll back the optimistic change.
          applyAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? optimisticTarget : attendee)),
          );
          notifyRequestError("Couldn't save", error);
          removePending(memberId);
        });
    },
    [
      attendees,
      classId,
      pendingMemberIds,
      addPending,
      removePending,
      applyAttendees,
      checkForRosterUpdates,
      clearSyncNotice,
      showSyncNotice,
    ],
  );

  const markAll = useCallback(
    (status: AttendanceStatus) => {
      setMarkingAllStatus(status);

      markAllAttendance(classId, status)
        .then(() => {
          // Mirrors the backend's filtered bulk UPDATE: only rows that actually
          // change status receive a new version. Repeating "mark all absent"
          // while everyone is already absent must stay a no-op for concurrency.
          applyAttendees((current) =>
            current.map((attendee) => {
              if (attendee.status === status) {
                return attendee;
              }

              return {
                ...attendee,
                status,
                version: attendee.version + 1,
                markedAt: status === 'attended' ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
        })
        .catch((error: unknown) => {
          notifyRequestError(
            status === 'attended' ? "Couldn't mark everyone present" : "Couldn't mark everyone absent",
            error,
          );
        })
        .finally(() => setMarkingAllStatus(null));
    },
    [classId, applyAttendees],
  );

  const markAllPresent = useCallback(() => markAll('attended'), [markAll]);
  const markAllAbsent = useCallback(() => markAll('not_attended'), [markAll]);

  const presentCount = attendees.filter((attendee) => attendee.status === 'attended').length;

  return {
    status,
    attendees,
    errorMessage,
    pendingMemberIds,
    syncNotices,
    isMarkingAllPresent: markingAllStatus === 'attended',
    isMarkingAllAbsent: markingAllStatus === 'not_attended',
    isRefreshing,
    hasRosterUpdates,
    presentCount,
    totalCount: attendees.length,
    retry: load,
    refreshRoster,
    toggleAttendee,
    dismissSyncNotice: clearSyncNotice,
    markAllPresent,
    markAllAbsent,
  };
}
