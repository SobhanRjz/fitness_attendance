import { getMembershipType } from '../membership';

describe('getMembershipType', () => {
  it('is deterministic for the same member id', () => {
    expect(getMembershipType(42)).toBe(getMembershipType(42));
  });

  it('cycles through the three membership types', () => {
    const types = new Set([0, 1, 2].map(getMembershipType));
    expect(types.size).toBe(3);
  });
});
