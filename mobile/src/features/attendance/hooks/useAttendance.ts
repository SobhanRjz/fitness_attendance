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

/** How often we poll the server, compare-only, for changes made by other staff. */
const ROSTER_POLL_INTERVAL_MS = 10_000;

/**
 * Owns the roster's data lifecycle
 */
export function useAttendance(classId: number): UseAttendanceResult {
  const [status, setStatus] = useState<AttendanceLoadStatus>('loading');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<number>>(new Set());
  const [markingAllStatus, setMarkingAllStatus] = useState<AttendanceStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRosterUpdates, setHasRosterUpdates] = useState(false);
  const [syncNotices, setSyncNotices] = useState<Map<number, SyncNoticeDetails>>(new Map());
  const attendeesRef = useRef<Attendee[]>([]);
  const pendingMemberIdsRef = useRef<Set<number>>(new Set());
  const statusRef = useRef<AttendanceLoadStatus>('loading');

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

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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


  const checkForRosterUpdates = useCallback(
    (excludeMemberId?: number): void => {
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (statusRef.current !== 'success') {
        return; // Nothing to compare against yet (still loading or errored).
      }
      checkForRosterUpdates();
    }, ROSTER_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [checkForRosterUpdates]);


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

          applyAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? updated : attendee)),
          );
          removePending(memberId);

          //checkForRosterUpdates(memberId);
        })
        .catch((error: unknown) => {
          if (error instanceof AttendanceConflictError) {
            applyAttendees((current) =>
              current.map((attendee) => (attendee.member.id === memberId ? error.fresh : attendee)),
            );
            removePending(memberId);
            // if (nextStatus !== error.fresh.status) {
            //   showSyncNotice(memberId, error.fresh);
            // }
            showSyncNotice(memberId, error.fresh);
            //checkForRosterUpdates(memberId);
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
