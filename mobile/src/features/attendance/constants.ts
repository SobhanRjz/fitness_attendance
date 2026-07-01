import { ClassInfo } from './types';

/**
 * The design shows a single roster screen with no class picker, so the app
 * targets one hardcoded class. Change this to point at a different class
 * seeded in your backend.
 */
export const DEMO_CLASS_ID = 1;

/**
 * Placeholder header content — the backend doesn't expose class name, time,
 * duration, or trainer via any endpoint yet. The roster, statuses, and counts
 * below this header are all live data from the real API.
 */
export const DEMO_CLASS_INFO: ClassInfo = {
  name: 'Power HIIT 45',
  time: '6:30 AM',
  durationMinutes: 45,
  trainerName: 'Jordan Vega',
};
