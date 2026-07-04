import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../../../shared/alert';
import {
  AttendanceConflictError,
  getAttendees,
  markAllAttendance,
  updateAttendance,
} from '../api/attendanceApi';
import { Attendee, AttendanceStatus } from '../types';

export type AttendanceLoadStatus = 'loading' | 'success' | 'error';

export interface UseAttendanceResult {
  status: AttendanceLoadStatus;
  attendees: Attendee[];
  errorMessage: string | null;
  pendingMemberIds: ReadonlySet<number>;
  isMarkingAllPresent: boolean;
  isMarkingAllAbsent: boolean;
  isRefreshing: boolean;
  hasRosterUpdates: boolean;
  presentCount: number;
  totalCount: number;
  retry: () => void;
  refreshRoster: () => void;
  toggleAttendee: (memberId: number) => void;
  markAllPresent: () => void;
  markAllAbsent: () => void;
}

function oppositeStatus(status: AttendanceStatus): AttendanceStatus {
  return status === 'attended' ? 'not_attended' : 'attended';
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

  const load = useCallback(() => {
    setStatus('loading');
    setErrorMessage(null);
    setHasRosterUpdates(false);

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
   * currently in flight is skipped too, since a stale-looking version there
   * just means our own write hasn't landed yet.
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
            return local === undefined || local.version !== fresh.version;
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
      })
      .catch((error: unknown) => {
        notify("Couldn't refresh", error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => setIsRefreshing(false));
  }, [classId, applyAttendees]);

  const toggleAttendee = useCallback(
    (memberId: number) => {
      if (pendingMemberIds.has(memberId)) {
        return; // A save is already in flight for this row.
      }

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
            // Someone else already updated this row first — the write was
            // rejected, nothing was overwritten. Reconcile this exact row to
            // the server's version immediately (it's the one row we know
            // for certain is stale); other rows are handled the same way as
            // the success path — flagged, not silently overwritten.
            applyAttendees((current) =>
              current.map((attendee) => (attendee.member.id === memberId ? error.fresh : attendee)),
            );
            removePending(memberId);
            notify(
              'Updated by another staff member',
              'This attendee was already updated elsewhere. Pull to refresh for the latest roster.',
            );
            checkForRosterUpdates(memberId);
            return;
          }

          // Any other failure: roll back the optimistic change.
          applyAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? optimisticTarget : attendee)),
          );
          notify("Couldn't save", error instanceof Error ? error.message : 'Please try again.');
          removePending(memberId);
        });
    },
    [attendees, classId, pendingMemberIds, addPending, removePending, applyAttendees, checkForRosterUpdates],
  );

  const markAll = useCallback(
    (status: AttendanceStatus) => {
      setMarkingAllStatus(status);

      markAllAttendance(classId, status)
        .then(() => {
          // Mirrors the backend's single atomic UPDATE: every row moves to the
          // requested status and its version is bumped by one. Avoids a
          // refetch/flash.
          applyAttendees((current) =>
            current.map((attendee) => ({
              ...attendee,
              status,
              version: attendee.version + 1,
              markedAt: status === 'attended' ? new Date().toISOString() : null,
            })),
          );
        })
        .catch((error: unknown) => {
          notify(
            status === 'attended' ? "Couldn't mark everyone present" : "Couldn't mark everyone absent",
            error instanceof Error ? error.message : 'Please try again.',
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
    isMarkingAllPresent: markingAllStatus === 'attended',
    isMarkingAllAbsent: markingAllStatus === 'not_attended',
    isRefreshing,
    hasRosterUpdates,
    presentCount,
    totalCount: attendees.length,
    retry: load,
    refreshRoster,
    toggleAttendee,
    markAllPresent,
    markAllAbsent,
  };
}
