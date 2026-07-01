import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { ClassInfo } from '../types';

interface ClassSummaryCardProps {
  classInfo: ClassInfo;
  variant: 'loading' | 'success' | 'error';
  presentCount: number;
  totalCount: number;
  isMarkingAllPresent: boolean;
  isMarkingAllAbsent: boolean;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
}

/**
 * Class title is always shown immediately (it's static placeholder content,
 * not fetched — see constants.ts). The count, progress bar, and "mark all"
 * buttons reflect the live roster and are hidden until it loads successfully.
 */
export function ClassSummaryCard({
  classInfo,
  variant,
  presentCount,
  totalCount,
  isMarkingAllPresent,
  isMarkingAllAbsent,
  onMarkAllPresent,
  onMarkAllAbsent,
}: ClassSummaryCardProps) {
  const isMarkingAll = isMarkingAllPresent || isMarkingAllAbsent;
  const progress = totalCount === 0 ? 0 : presentCount / totalCount;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classInfo.name}</Text>

      {variant === 'success' && (
        <>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="time-outline" size={13} color={colors.badgeText} />
              <Text style={styles.badgeText}>{classInfo.time}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{classInfo.durationMinutes} min</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="person-outline" size={13} color={colors.badgeText} />
              <Text style={styles.badgeText}>{classInfo.trainerName}</Text>
            </View>
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {presentCount} / {totalCount}
            </Text>
          </View>

          <View style={styles.markAllRow}>
            <Pressable
              onPress={onMarkAllPresent}
              disabled={isMarkingAll}
              style={({ pressed }) => [
                styles.markAllButton,
                styles.markAllPresentButton,
                pressed && styles.markAllButtonPressed,
              ]}
            >
              {isMarkingAllPresent ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.markAllPresentText}>Mark all present</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onMarkAllAbsent}
              disabled={isMarkingAll}
              style={({ pressed }) => [
                styles.markAllButton,
                styles.markAllAbsentButton,
                pressed && styles.markAllButtonPressed,
              ]}
            >
              {isMarkingAllAbsent ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.markAllAbsentText}>Mark all absent</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </>
      )}

      {variant === 'loading' && <View style={styles.skeletonBar} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  title: {
    color: colors.textInverse,
    fontSize: 26,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.badgeBackground,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.badgeText,
    fontSize: 12,
    fontWeight: '600',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    color: colors.textInverse,
    fontSize: 32,
    fontWeight: '700',
  },
  markAllRow: {
    flexDirection: 'row',
    gap: 8,
  },
  markAllButton: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  markAllButtonPressed: {
    opacity: 0.85,
  },
  markAllPresentButton: {
    backgroundColor: colors.accent,
  },
  markAllAbsentButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textInverseMuted,
  },
  markAllPresentText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  markAllAbsentText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.progressFill,
  },
  skeletonBar: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.skeletonBackground,
  },
});
