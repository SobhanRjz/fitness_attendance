import { StatusBar } from 'expo-status-bar';
import { FlatList, Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { AttendeeRow } from '../components/AttendeeRow';
import { ClassSummaryCard } from '../components/ClassSummaryCard';
import { RosterErrorState } from '../components/RosterErrorState';
import { RosterSectionHeader } from '../components/RosterSectionHeader';
import { RosterSkeleton } from '../components/RosterSkeleton';
import { RosterTopBar, SaveState } from '../components/RosterTopBar';
import { useAttendance } from '../hooks/useAttendance';
import { ClassInfo } from '../types';

interface AttendanceScreenProps {
  classId: number;
  classInfo: ClassInfo;
}

/**
 * The three states in the design (live roster / loading / error) are all
 * this one screen, driven by useAttendance's status — not separate routes.
 */
export function AttendanceScreen({ classId, classInfo }: AttendanceScreenProps) {
  const {
    status,
    attendees,
    errorMessage,
    pendingMemberIds,
    isMarkingAllPresent,
    isMarkingAllAbsent,
    presentCount,
    totalCount,
    retry,
    toggleAttendee,
    markAllPresent,
    markAllAbsent,
  } = useAttendance(classId);

  const saveState: SaveState =
    status !== 'success'
      ? 'hidden'
      : isMarkingAllPresent || isMarkingAllAbsent || pendingMemberIds.size > 0
        ? 'saving'
        : 'saved';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <RosterTopBar saveState={saveState} />
        <ClassSummaryCard
          classInfo={classInfo}
          variant={status}
          presentCount={presentCount}
          totalCount={totalCount}
          isMarkingAllPresent={isMarkingAllPresent}
          isMarkingAllAbsent={isMarkingAllAbsent}
          onMarkAllPresent={markAllPresent}
          onMarkAllAbsent={markAllAbsent}
        />
      </View>

      <SafeAreaView style={styles.content} edges={['bottom']}>
        {status === 'loading' && <RosterSkeleton />}

        {status === 'error' && <RosterErrorState message={errorMessage} onRetry={retry} />}

        {status === 'success' && (
          <FlatList
            data={attendees}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <AttendeeRow
                attendee={item}
                pending={pendingMemberIds.has(item.member.id)}
                onToggle={() => toggleAttendee(item.member.id)}
              />
            )}
            ListHeaderComponent={<RosterSectionHeader totalCount={totalCount} />}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.headerBackground,
  },
  header: {
    backgroundColor: colors.headerBackground,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) + 8 : 20,
  },
  content: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: 24,
  },
});
