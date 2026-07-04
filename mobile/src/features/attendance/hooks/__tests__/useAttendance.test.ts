import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AttendanceConflictError } from '../../api/attendanceApi';
import * as attendanceApi from '../../api/attendanceApi';
import { Attendee } from '../../types';
import { useAttendance } from '../useAttendance';

// Keep the real error classes (their constructors matter — e.g.
// AttendanceConflictError.fresh) and only mock the network-calling functions.
jest.mock('../../api/attendanceApi', () => ({
  ...jest.requireActual('../../api/attendanceApi'),
  getAttendees: jest.fn(),
  updateAttendance: jest.fn(),
  markAllAttendance: jest.fn(),
}));

const mockedApi = attendanceApi as jest.Mocked<typeof attendanceApi>;

function makeAttendee(overrides: Partial<Attendee> = {}): Attendee {
  return {
    id: 1,
    member: { id: 10, name: 'Maya Brooks' },
    status: 'not_attended',
    version: 1,
    markedAt: null,
    ...overrides,
  };
}

describe('useAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads attendees and exposes derived counts', async () => {
    const attendees = [
      makeAttendee({ status: 'attended' }),
      makeAttendee({ id: 2, member: { id: 11, name: 'Liam Carter' } }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(attendees);

    const { result } = renderHook(() => useAttendance(1));
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.attendees).toHaveLength(2);
    expect(result.current.presentCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
  });

  it('sets an error state when the initial load fails', async () => {
    mockedApi.getAttendees.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useAttendance(1));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('network down');
  });

  it('optimistically toggles a row, then applies the server response', async () => {
    const attendee = makeAttendee({ status: 'not_attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    let resolveUpdate!: (value: Attendee) => void;
    mockedApi.updateAttendance.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    // Background "did anything else change" check fired after the update succeeds.
    mockedApi.getAttendees.mockResolvedValueOnce([makeAttendee({ status: 'attended', version: 2 })]);

    act(() => {
      result.current.toggleAttendee(10);
    });

    expect(result.current.attendees[0]?.status).toBe('attended');
    expect(result.current.pendingMemberIds.has(10)).toBe(true);

    await act(async () => {
      resolveUpdate(makeAttendee({ status: 'attended', version: 2 }));
      await Promise.resolve();
    });

    expect(result.current.attendees[0]?.version).toBe(2);
    expect(result.current.pendingMemberIds.has(10)).toBe(false);
    expect(result.current.hasRosterUpdates).toBe(false);
  });

  it('flags that other rows changed elsewhere, without silently overwriting them, then applies them on refresh', async () => {
    // Mirrors the "Staff A / Staff B" scenario: two other rows were already
    // changed elsewhere by the time this staff member's screen updates row 2.
    const rows = [
      makeAttendee({ id: 1, member: { id: 10, name: 'Row One' }, status: 'not_attended', version: 1 }),
      makeAttendee({ id: 2, member: { id: 11, name: 'Row Two' }, status: 'not_attended', version: 1 }),
      makeAttendee({ id: 3, member: { id: 12, name: 'Row Three' }, status: 'not_attended', version: 1 }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(rows);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.updateAttendance.mockResolvedValueOnce(
      makeAttendee({ id: 2, member: { id: 11, name: 'Row Two' }, status: 'attended', version: 2 }),
    );
    // Rows 1 and 3 were bumped to version 2 by another staff member in the meantime.
    const latestFromServer = [
      makeAttendee({ id: 1, member: { id: 10, name: 'Row One' }, status: 'attended', version: 2 }),
      makeAttendee({ id: 2, member: { id: 11, name: 'Row Two' }, status: 'attended', version: 2 }),
      makeAttendee({ id: 3, member: { id: 12, name: 'Row Three' }, status: 'attended', version: 2 }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(latestFromServer);

    await act(async () => {
      result.current.toggleAttendee(11);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Only the tapped row was sent to the backend.
    expect(mockedApi.updateAttendance).toHaveBeenCalledTimes(1);
    expect(mockedApi.updateAttendance).toHaveBeenCalledWith(1, 11, 'attended', 1);

    // Row 2 was applied immediately from the API response...
    expect(result.current.pendingMemberIds.has(11)).toBe(false);
    expect(result.current.attendees.find((a) => a.member.id === 11)?.version).toBe(2);

    // ...but rows 1 and 3 are NOT silently overwritten — the background check
    // only raises a flag so the user can decide when to pull to refresh.
    await waitFor(() => expect(result.current.hasRosterUpdates).toBe(true));
    expect(result.current.attendees.find((a) => a.member.id === 10)?.version).toBe(1);
    expect(result.current.attendees.find((a) => a.member.id === 12)?.version).toBe(1);

    // Pulling to refresh brings the latest data in and clears the flag.
    mockedApi.getAttendees.mockResolvedValueOnce(latestFromServer);
    await act(async () => {
      result.current.refreshRoster();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.hasRosterUpdates).toBe(false);
    expect(result.current.attendees.every((attendee) => attendee.status === 'attended')).toBe(true);
    expect(result.current.attendees.map((attendee) => attendee.version)).toEqual([2, 2, 2]);
  });

  it('rolls back the optimistic change when the save fails', async () => {
    const attendee = makeAttendee({ status: 'not_attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.updateAttendance.mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      result.current.toggleAttendee(10);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.attendees[0]?.status).toBe('not_attended');
    expect(result.current.pendingMemberIds.has(10)).toBe(false);
  });

  it('reconciles to the server row immediately on a 409 conflict, then flags other roster changes', async () => {
    const rows = [
      makeAttendee({ id: 1, member: { id: 10, name: 'Row One' }, status: 'not_attended', version: 1 }),
      makeAttendee({ id: 2, member: { id: 11, name: 'Row Two' }, status: 'not_attended', version: 1 }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(rows);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    const freshFromServer = makeAttendee({ id: 1, member: { id: 10, name: 'Row One' }, status: 'attended', version: 5 });
    mockedApi.updateAttendance.mockRejectedValueOnce(new AttendanceConflictError(freshFromServer));
    // Row 2 was also changed elsewhere in the meantime.
    mockedApi.getAttendees.mockResolvedValueOnce([
      freshFromServer,
      makeAttendee({ id: 2, member: { id: 11, name: 'Row Two' }, status: 'attended', version: 2 }),
    ]);

    act(() => {
      result.current.toggleAttendee(10);
    });

    // The conflicting row is reconciled to the server's version immediately,
    // and freed up for the next tap right away — no waiting on a refetch.
    await waitFor(() => expect(result.current.attendees[0]?.version).toBe(5));
    expect(result.current.attendees[0]?.status).toBe('attended');
    expect(result.current.pendingMemberIds.has(10)).toBe(false);

    // The other row is NOT silently overwritten — only flagged.
    await waitFor(() => expect(result.current.hasRosterUpdates).toBe(true));
    expect(result.current.attendees[1]?.version).toBe(1);
  });

  it('does not raise a false "updates available" flag if the post-conflict background check fails', async () => {
    const attendee = makeAttendee({ status: 'not_attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    const freshFromServer = makeAttendee({ status: 'attended', version: 5 });
    mockedApi.updateAttendance.mockRejectedValueOnce(new AttendanceConflictError(freshFromServer));
    mockedApi.getAttendees.mockRejectedValueOnce(new Error('offline'));

    act(() => {
      result.current.toggleAttendee(10);
    });

    await waitFor(() => expect(result.current.pendingMemberIds.has(10)).toBe(false));
    expect(result.current.attendees[0]?.version).toBe(5);
    expect(result.current.attendees[0]?.status).toBe('attended');
    expect(result.current.hasRosterUpdates).toBe(false);
  });

  it('refreshRoster surfaces an error and stops refreshing if the fetch fails', async () => {
    const attendee = makeAttendee({ status: 'not_attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.getAttendees.mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      result.current.refreshRoster();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.attendees[0]?.version).toBe(1);
  });

  it('marks every attendee present and bumps each version by one', async () => {
    const attendees = [
      makeAttendee({ id: 1, member: { id: 10, name: 'A' }, status: 'not_attended', version: 1 }),
      makeAttendee({ id: 2, member: { id: 11, name: 'B' }, status: 'not_attended', version: 3 }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(attendees);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.markAllAttendance.mockResolvedValueOnce({ updated: 2, status: 'attended' });

    await act(async () => {
      result.current.markAllPresent();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.attendees.every((a) => a.status === 'attended')).toBe(true);
    expect(result.current.attendees[0]?.version).toBe(2);
    expect(result.current.attendees[1]?.version).toBe(4);
  });

  it('marks every attendee absent, bumps each version, and clears markedAt', async () => {
    const attendees = [
      makeAttendee({
        id: 1,
        member: { id: 10, name: 'A' },
        status: 'attended',
        version: 1,
        markedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeAttendee({
        id: 2,
        member: { id: 11, name: 'B' },
        status: 'attended',
        version: 3,
        markedAt: '2024-01-01T00:00:00.000Z',
      }),
    ];
    mockedApi.getAttendees.mockResolvedValueOnce(attendees);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.markAllAttendance.mockResolvedValueOnce({ updated: 2, status: 'not_attended' });

    await act(async () => {
      result.current.markAllAbsent();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedApi.markAllAttendance).toHaveBeenCalledWith(1, 'not_attended');
    expect(result.current.attendees.every((a) => a.status === 'not_attended')).toBe(true);
    expect(result.current.attendees.every((a) => a.markedAt === null)).toBe(true);
    expect(result.current.attendees[0]?.version).toBe(2);
    expect(result.current.attendees[1]?.version).toBe(4);
  });

  it('rolls back to loading state and surfaces an alert when marking all absent fails', async () => {
    const attendee = makeAttendee({ status: 'attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    mockedApi.markAllAttendance.mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      result.current.markAllAbsent();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.attendees[0]?.status).toBe('attended');
    expect(result.current.isMarkingAllAbsent).toBe(false);
  });
});
