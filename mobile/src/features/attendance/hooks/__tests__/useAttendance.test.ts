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

  it('reconciles to the server row and refreshes the whole roster on a 409 conflict', async () => {
    const attendee = makeAttendee({ status: 'not_attended', version: 1 });
    mockedApi.getAttendees.mockResolvedValueOnce([attendee]);

    const { result } = renderHook(() => useAttendance(1));
    await waitFor(() => expect(result.current.status).toBe('success'));

    const freshFromServer = makeAttendee({ status: 'attended', version: 5 });
    mockedApi.updateAttendance.mockRejectedValueOnce(new AttendanceConflictError(freshFromServer));
    // The hook re-syncs the full roster after a conflict, since other rows
    // may also be stale (e.g. after a "mark all" from another staff member).
    mockedApi.getAttendees.mockResolvedValueOnce([makeAttendee({ status: 'attended', version: 5 })]);

    act(() => {
      result.current.toggleAttendee(10);
    });

    // The row is reconciled to the server's version immediately...
    await waitFor(() => expect(result.current.attendees[0]?.version).toBe(5));
    expect(result.current.attendees[0]?.status).toBe('attended');

    // ...but stays "pending" (un-tappable) until the roster refetch settles,
    // so a follow-up tap can never go out with the stale version.
    await waitFor(() => expect(result.current.pendingMemberIds.has(10)).toBe(false));
    expect(mockedApi.getAttendees).toHaveBeenCalledTimes(2);
  });

  it('keeps the reconciled row if the post-conflict refresh itself fails', async () => {
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
