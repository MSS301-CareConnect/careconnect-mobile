import type { NativeStackScreenProps } from '@react-navigation/native-stack';
export type Routes = {
  Tabs: { screen?: 'Home' | 'Schedule' | 'Work' | 'Availability' | 'Profile' } | undefined;
  History: undefined;
  Visit: { id: string };
  Session: { id: string };
  Report: { bookingId: string; sessionId: string };
  Notifications: undefined;
  Account: undefined;
  ProviderSchedule: undefined;
  WorkShifts: undefined;
  WorkShift: { id: string };
  Forgot: undefined;
};
export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
