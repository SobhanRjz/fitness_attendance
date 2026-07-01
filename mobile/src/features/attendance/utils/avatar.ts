import { avatarPalette } from '../../../theme/colors';

/**
 * "Maya Brooks" -> "MB". Falls back to the first letter if there's no
 * second word, and to "?" for an empty name.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

/**
 * Deterministic avatar background color derived from the member's name, so
 * the same member always renders with the same color across reloads without
 * needing a backend field for it.
 */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % avatarPalette.length;
  return avatarPalette[index]!;
}
