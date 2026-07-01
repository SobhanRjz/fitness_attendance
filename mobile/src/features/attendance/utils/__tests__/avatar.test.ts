import { getAvatarColor, getInitials } from '../avatar';

describe('getInitials', () => {
  it('takes the first letter of the first and last word', () => {
    expect(getInitials('Maya Brooks')).toBe('MB');
  });

  it('falls back to the first two letters for a single word', () => {
    expect(getInitials('Cher')).toBe('CH');
  });

  it('returns a placeholder for an empty name', () => {
    expect(getInitials('   ')).toBe('?');
  });
});

describe('getAvatarColor', () => {
  it('is deterministic for the same name', () => {
    expect(getAvatarColor('Maya Brooks')).toBe(getAvatarColor('Maya Brooks'));
  });

  it('picks a color from the fixed palette', () => {
    const color = getAvatarColor('Liam Carter');
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
