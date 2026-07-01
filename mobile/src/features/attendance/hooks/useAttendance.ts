import { useCallback, useEffect, useState } from 'react';
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
  presentCount: number;
  totalCount: number;
  retry: () => void;
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
 * with rollback/conflict-reconciliation, and the "mark all present"/"mark
 * all absent" bulk actions.
 */
export function useAttendance(classId: number): UseAttendanceResult {
  const [status, setStatus] = useState<AttendanceLoadStatus>('loading');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<number>>(new Set());
  const [markingAllStatus, setMarkingAllStatus] = useState<AttendanceStatus | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    setErrorMessage(null);

    getAttendees(classId)
      .then((data) => {
        setAttendees(data);
        setStatus('success');
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
        setStatus('error');
      });
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const addPending = useCallback((memberId: number) => {
    setPendingMemberIds((current) => new Set(current).add(memberId));
  }, []);

  const removePending = useCallback((memberId: number) => {
    setPendingMemberIds((current) => {
      const next = new Set(current);
      next.delete(memberId);
      return next;
    });
  }, []);

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

      setAttendees((current) =>
        current.map((attendee) =>
          attendee.member.id === memberId ? { ...attendee, status: nextStatus } : attendee,
        ),
      );
      addPending(memberId);

      updateAttendance(classId, memberId, nextStatus, optimisticTarget.version)
        .then((updated) => {
          setAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? updated : attendee)),
          );
          removePending(memberId);
        })
        .catch((error: unknown) => {
          if (error instanceof AttendanceConflictError) {
            // Someone else already updated this row first — the write was
            // rejected, nothing was overwritten. Reconcile this row to the
            // server's version immediately, then re-sync the whole roster
            // (other rows may be stale too). Keep this row "pending" (and
            // therefore un-tappable) until that refetch settles, so the next
            // tap always goes out with a current version.
            setAttendees((current) =>
              current.map((attendee) => (attendee.member.id === memberId ? error.fresh : attendee)),
            );
            notify(
              'Updated by another staff member',
              'This attendee was already updated elsewhere. The roster has been refreshed with the latest data.',
            );
            return getAttendees(classId)
              .then((data) => setAttendees(data))
              .catch(() => {
                // Refresh failed — the reconciled row from `error.fresh` above still stands.
              })
              .finally(() => removePending(memberId));
          }

          // Any other failure: roll back the optimistic change.
          setAttendees((current) =>
            current.map((attendee) => (attendee.member.id === memberId ? optimisticTarget : attendee)),
          );
          notify("Couldn't save", error instanceof Error ? error.message : 'Please try again.');
          removePending(memberId);
        });
    },
    [attendees, classId, pendingMemberIds, addPending, removePending],
  );

  const markAll = useCallback(
    (status: AttendanceStatus) => {
      setMarkingAllStatus(status);

      markAllAttendance(classId, status)
        .then(() => {
          // Mirrors the backend's single atomic UPDATE: every row moves to the
          // requested status and its version is bumped by one. Avoids a
          // refetch/flash.
          setAttendees((current) =>
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
    [classId],
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
    presentCount,
    totalCount: attendees.length,
    retry: load,
    toggleAttendee,
    markAllPresent,
    markAllAbsent,
  };
}
