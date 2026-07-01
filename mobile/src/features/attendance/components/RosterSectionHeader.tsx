import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

interface RosterSectionHeaderProps {
  totalCount: number;
}

export function RosterSectionHeader({ totalCount }: RosterSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>ROSTER · {totalCount}</Text>
      <Text style={styles.hint}>tap a row to toggle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
