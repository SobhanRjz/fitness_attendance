import { avatarPalette } from '../../../../theme/colors';
import { getAvatarColor, getInitials } from '../avatar';

describe('getInitials', () => {
  it('returns first and last initials for a full name', () => {
    expect(getInitials('Maya Brooks')).toBe('MB');
  });

  it('returns up to two letters for a single word', () => {
    expect(getInitials('Maya')).toBe('MA');
  });

  it('returns ? for an empty name', () => {
    expect(getInitials('   ')).toBe('?');
  });
});

describe('getAvatarColor', () => {
  it('returns a palette color deterministically', () => {
    const color = getAvatarColor('Maya Brooks');

    expect(avatarPalette).toContain(color);
    expect(getAvatarColor('Maya Brooks')).toBe(color);
  });
});
