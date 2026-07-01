import { Platform } from 'react-native';

/**
 * Resolves the API base URL for the Laravel backend.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL (set via mobile/.env) — required for physical
 *    devices, which must use your machine's LAN IP instead of localhost.
 * 2. Android emulator default: 10.0.2.2 maps to the host machine's localhost.
 * 3. iOS simulator / web default: localhost.
 */
function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${defaultHost}:8000/api`;
}

let cachedBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (!cachedBaseUrl) {
    cachedBaseUrl = resolveApiBaseUrl();
    if (__DEV__) {
      console.log('[attendance] API base URL:', cachedBaseUrl);
    }
  }
  return cachedBaseUrl;
}
