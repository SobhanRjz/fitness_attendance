const MEMBERSHIP_TYPES = ['Unlimited', '10 Pack', 'Drop-in'] as const;

export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

/**
 * The backend has no membership-plan field, so this derives a stable,
 * display-only label from the member's ID purely to match the design —
 * it does not reflect a real membership plan.
 */
export function getMembershipType(memberId: number): MembershipType {
  return MEMBERSHIP_TYPES[memberId % MEMBERSHIP_TYPES.length]!;
}
