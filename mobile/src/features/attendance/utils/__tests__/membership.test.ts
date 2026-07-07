import { getMembershipType } from '../membership';

describe('getMembershipType', () => {
  it('maps member ids to a stable display label', () => {
    expect(getMembershipType(0)).toBe('Unlimited');
    expect(getMembershipType(1)).toBe('10 Pack');
    expect(getMembershipType(2)).toBe('Drop-in');
    expect(getMembershipType(3)).toBe('Unlimited');
  });
});
