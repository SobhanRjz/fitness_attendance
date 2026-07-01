import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { Attendee } from '../types';
import { getAvatarColor, getInitials } from '../utils/avatar';
import { getMembershipType } from '../utils/membership';

interface AttendeeRowProps {
  attendee: Attendee;
  pending: boolean;
  onToggle: () => void;
}

export function AttendeeRow({ attendee, pending, onToggle }: AttendeeRowProps) {
  const isPresent = attendee.status === 'attended';

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(attendee.member.name) }]}>
        <Text style={styles.avatarText}>{getInitials(attendee.member.name)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {attendee.member.name}
        </Text>
        <Text style={styles.membership}>{getMembershipType(attendee.member.id)}</Text>
      </View>

      <Pressable
        onPress={onToggle}
        disabled={pending}
        style={[styles.statusPill, isPresent ? styles.statusPillPresent : styles.statusPillAbsent]}
      >
        {pending ? (
          <ActivityIndicator size="small" color={isPresent ? colors.presentPillText : colors.absentPillText} />
        ) : (
          <>
            {isPresent && <Ionicons name="checkmark" size={14} color={colors.presentPillText} />}
            <Text style={isPresent ? styles.statusTextPresent : styles.statusTextAbsent}>
              {isPresent ? 'Present' : 'Absent'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  membership: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 88,
    justifyContent: 'center',
  },
  statusPillPresent: {
    backgroundColor: colors.presentPillBackground,
  },
  statusPillAbsent: {
    backgroundColor: colors.absentPillBackground,
  },
  statusTextPresent: {
    color: colors.presentPillText,
    fontSize: 13,
    fontWeight: '700',
  },
  statusTextAbsent: {
    color: colors.absentPillText,
    fontSize: 13,
    fontWeight: '700',
  },
});
