import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

interface RosterUpdateBannerProps {
  onRefresh: () => void;
}

/**
 * Shown when a background check notices another staff member changed a row
 * we haven't seen yet. Tapping it (or pulling to refresh) is what actually
 * brings the new data in — we never swap rows out from under the user
 * silently.
 */
export function RosterUpdateBanner({ onRefresh }: RosterUpdateBannerProps) {
  return (
    <Pressable
      onPress={onRefresh}
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
    >
      <Ionicons name="refresh" size={16} color={colors.accent} />
      <Text style={styles.text}>New updates from other staff are available</Text>
      <Text style={styles.action}>Refresh</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  containerPressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  action: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
