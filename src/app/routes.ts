import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
export type WorkScheduleSection = 'agenda' | 'register' | 'timeOff';
export type VisitListRange = 'today' | 'upcoming' | 'all' | 'history';
export type MainTabs = {
  Home: undefined;
  Schedule: { range?: VisitListRange } | undefined;
  Availability: { section?: WorkScheduleSection } | undefined;
  Profile: undefined;
};
export type Routes = {
  Tabs: NavigatorScreenParams<MainTabs> | undefined;
  History: undefined;
  Visit: { id: string };
  Session: { id: string };
  Report: { bookingId: string; sessionId: string };
  Notifications: undefined;
  Account: undefined;
  BookingRequests: { bookingId?: string } | undefined;
  KeptDeposits: undefined;
  TimeOff: undefined;
  Certificates: undefined;
  SecuritySessions: undefined;
  ProviderSchedule: { scheduleId?: string; cancel?: boolean } | undefined;
  WorkShift: { id: string };
  Forgot: undefined;
};
export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
