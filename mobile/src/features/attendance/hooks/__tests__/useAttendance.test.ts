import { act, renderHook, waitFor } from '@testing-library/react-native';
import { notify } from '../../../../shared/alert';
import {
  AttendanceConflictError,
  getAttendees,
  updateAttendance,
} from '../../api/attendanceApi';
import { Attendee } from '../../types';
import { useAttendance } from '../useAttendance';

jest.mock('../../api/attendanceApi', () => {
  const actual = jest.requireActual<typeof import('../../api/attendanceApi')>('../../api/attendanceApi');
  return {
    ...actual,
    getAttendees: jest.fn(),
    updateAttendance: jest.fn(),
    markAllAttendance: jest.fn(),
  };
});
jest.mock('../../../../shared/alert', () => ({
  notify: jest.fn(),
}));

const mockedGetAttendees = getAttendees as jest.MockedFunction<typeof getAttendees>;
const mockedUpdateAttendance = updateAttendance as jest.MockedFunction<typeof updateAttendance>;

function attendee(
  memberId: number,
  status: Attendee['status'] = 'not_attended',
  version = 1,
): Attendee {
  return {
    id: memberId,
    member: { id: memberId, name: `Member ${memberId}` },
    status,
    version,
    markedAt: status === 'attended' ? '2026-01-01T10:00:00Z' : null,
    updatedAt: '2026-01-01T10:00:00Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAttendance', () => {
  it('loads roster on mount', async () => {
    const roster = [attendee(1), attendee(2, 'attended')];
    mockedGetAttendees.mockResolvedValue(roster);

    const { result } = renderHook(() => useAttendance(42));

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.attendees).toEqual(roster);
    expect(result.current.presentCount).toBe(1);
    expect(mockedGetAttendees).toHaveBeenCalledWith(42);
  });

  describe('toggleAttendee', () => {
    it('optimistically flips status then applies the server row', async () => {
      const initial = attendee(1, 'not_attended', 3);
      const confirmed = {
        ...initial,
        status: 'attended' as const,
        version: 4,
        markedAt: '2026-01-01T11:00:00Z',
      };

      mockedGetAttendees
        .mockResolvedValueOnce([initial])
        .mockResolvedValue([confirmed]);
      mockedUpdateAttendance.mockResolvedValue(confirmed);

      const { result } = renderHook(() => useAttendance(42));
      await waitFor(() => expect(result.current.status).toBe('success'));

      act(() => {
        result.current.toggleAttendee(1);
      });

      expect(result.current.attendees[0].status).toBe('attended');

      await waitFor(() => expect(result.current.pendingMemberIds.has(1)).toBe(false));

      expect(mockedUpdateAttendance).toHaveBeenCalledWith(42, 1, 'attended', 3);
      expect(result.current.attendees[0]).toEqual(confirmed);
    });

    it('rolls back the optimistic change when the save fails', async () => {
      const initial = attendee(1, 'not_attended');
      mockedGetAttendees.mockResolvedValue([initial]);
      mockedUpdateAttendance.mockRejectedValue(new Error('Network down'));

      const { result } = renderHook(() => useAttendance(42));
      await waitFor(() => expect(result.current.status).toBe('success'));

      act(() => {
        result.current.toggleAttendee(1);
      });

      await waitFor(() => expect(result.current.attendees[0].status).toBe('not_attended'));

      expect(notify).toHaveBeenCalledWith("Couldn't save", 'Network down');
      expect(result.current.pendingMemberIds.has(1)).toBe(false);
    });

    it('reconciles a 409 conflict from the server and shows a sync notice', async () => {
      const initial = attendee(1, 'not_attended', 3);
      const fresh = attendee(1, 'attended', 5);

      mockedGetAttendees.mockResolvedValue([initial]);
      mockedUpdateAttendance.mockRejectedValue(new AttendanceConflictError(fresh));

      const { result } = renderHook(() => useAttendance(42));
      await waitFor(() => expect(result.current.status).toBe('success'));

      act(() => {
        result.current.toggleAttendee(1);
      });

      await waitFor(() => expect(result.current.syncNotices.has(1)).toBe(true));

      expect(result.current.attendees[0]).toEqual(fresh);
      expect(result.current.pendingMemberIds.has(1)).toBe(false);
    });
  });
});
