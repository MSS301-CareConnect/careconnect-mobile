import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
export type WorkScheduleSection = 'agenda' | 'register' | 'timeOff';
export type ShiftRegistrationView = 'open' | 'pending' | 'approved' | 'history';
export type VisitListRange = 'respond' | 'today' | 'upcoming' | 'all' | 'cancelled';
export type MainTabs = {
  Home: undefined;
  Schedule: { range?: VisitListRange; bookingId?: string } | undefined;
  Availability:
    { section?: WorkScheduleSection; registrationView?: ShiftRegistrationView } | undefined;
  Profile: undefined;
};
export type Routes = {
  Tabs: NavigatorScreenParams<MainTabs> | undefined;
  History: undefined;
  Visit: { id: string };
  BookingVisits: { bookingId: string; code?: string; name?: string };
  Session: { id: string };
  Report: { bookingId: string; sessionId: string };
  Notifications: undefined;
  Account: undefined;
  BookingRequests: { bookingId?: string } | undefined;
  KeptDeposits: undefined;
  Wallet: undefined;
  WalletWithdraw: undefined;
  Absences: undefined;
  Assistant: undefined;
  AbsenceExplain: { id: string };
  TimeOff: undefined;
  Certificates: undefined;
  SecuritySessions: undefined;
  ProviderSchedule: { scheduleId?: string; cancel?: boolean } | undefined;
  WorkShift: { id: string };
  RegisterShift: undefined;
  Forgot: undefined;
};
export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
