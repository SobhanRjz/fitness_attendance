import { Alert, Platform } from 'react-native';

/**
 * React Native's Alert.alert() renders a native dialog on iOS/Android but is
 * a no-op stub on web (react-native-web ships an empty implementation) — so
 * conflict/error messages would otherwise be silently swallowed when testing
 * in a browser. This falls back to the browser's window.alert there.
 */
export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }

  Alert.alert(title, message);
}
