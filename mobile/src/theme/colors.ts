/**
 * Design tokens for the attendance screen, matching the provided mockup
 * (dark header, purple accent, white roster surface).
 */
export const colors = {
  headerBackground: '#141319',
  badgeBackground: '#232230',
  badgeText: '#B8B6C4',
  skeletonBackground: '#2A2935',

  accent: '#7C5CFC',
  accentMuted: '#3A3452',
  accentSoft: '#EFEAFE',

  progressTrack: '#2E2C3A',
  progressFill: '#7C5CFC',

  surface: '#FFFFFF',
  surfaceMuted: '#F1F1F5',

  textPrimary: '#17161C',
  textSecondary: '#8A8A93',
  textInverse: '#FFFFFF',
  textInverseMuted: '#9C9AA8',

  presentPillBackground: '#7C5CFC',
  presentPillText: '#FFFFFF',
  absentPillBackground: '#F1F1F5',
  absentPillText: '#6B6B75',

  autoSavedDot: '#4ADE80',
  savingDot: '#F5B942',

  errorIconBackground: '#FBE4E4',
  errorIconColor: '#E0685F',

  divider: '#ECECF0',

  /** Soft inline hint when a row was reconciled from a 409 conflict. */
  syncNoticeText: '#EB5C8D',
  syncNoticeHint: '#C98BA8',
} as const;

/** Fixed palette for deterministic avatar background colors. */
export const avatarPalette = [
  '#F2994A',
  '#4A90D9',
  '#EB5757',
  '#27AE60',
  '#EB5C8D',
  '#9B51E0',
  '#2AB7B0',
  '#DD8E2E',
] as const;
