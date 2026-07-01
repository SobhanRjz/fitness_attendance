import { StyleSheet, View } from 'react-native';
import { colors } from '../../../theme/colors';

const SKELETON_ROW_COUNT = 7;

/** Placeholder rows shown in the content area while the roster is loading. */
export function RosterSkeleton() {
  return (
    <View style={styles.container}>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.lines}>
            <View style={[styles.line, styles.lineWide]} />
            <View style={[styles.line, styles.lineNarrow]} />
          </View>
          <View style={styles.pill} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceMuted,
  },
  lineWide: {
    width: '55%',
  },
  lineNarrow: {
    width: '30%',
  },
  pill: {
    width: 88,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
});
