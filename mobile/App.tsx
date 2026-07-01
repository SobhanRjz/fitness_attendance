import { DEMO_CLASS_ID, DEMO_CLASS_INFO } from './src/features/attendance/constants';
import { AttendanceScreen } from './src/features/attendance/screens/AttendanceScreen';

export default function App() {
  return <AttendanceScreen classId={DEMO_CLASS_ID} classInfo={DEMO_CLASS_INFO} />;
}
