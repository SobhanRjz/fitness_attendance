import { formatSyncNotice } from '../formatSyncNotice';

describe('formatSyncNotice', () => {
  it('describes a present update with a timestamp', () => {
    const message = formatSyncNotice({
      status: 'attended',
      markedAt: '2026-01-15T14:30:00.000Z',
      updatedAt: '2026-01-15T14:30:00.000Z',
    });

    expect(message).toContain('Previously updated at');
    expect(message).toContain('by another staff to present');
  });

  it('falls back to updatedAt for absent rows and uses absent wording', () => {
    const message = formatSyncNotice({
      status: 'not_attended',
      markedAt: null,
      updatedAt: '2026-01-15T09:00:00.000Z',
    });

    expect(message).toContain('Previously updated at');
    expect(message).toContain('by another staff to absent');
  });
});
