import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

export type SaveState = 'hidden' | 'saving' | 'saved';

interface RosterTopBarProps {
  saveState: SaveState;
}

/**
 * Back chevron + "CLASS ROSTER" eyebrow label, with an auto-save status pill
 * on the right (hidden until the roster has loaded).
 */
export function RosterTopBar({ saveState }: RosterTopBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name="chevron-back" size={20} color={colors.textInverse} />
        <Text style={styles.label}>CLASS ROSTER</Text>
      </View>

      {saveState !== 'hidden' && (
        <View style={styles.savePill}>
          <View
            style={[
              styles.saveDot,
              { backgroundColor: saveState === 'saving' ? colors.savingDot : colors.autoSavedDot },
            ]}
          />
          <Text style={styles.saveText}>{saveState === 'saving' ? 'Saving…' : 'Auto-saved'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: colors.textInverseMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveText: {
    color: colors.textInverseMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
