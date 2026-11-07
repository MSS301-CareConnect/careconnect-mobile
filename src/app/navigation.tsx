import React from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../core/app-context';
import { BrandTitle } from '../core/brand';
import { MainTabs, Routes } from './routes';
import { ToolbarTabIcon, RoundedTabButton } from './tab-bar-ui';
import { Button, Card, Screen, Title, Txt, colors } from '../core/ui';
import { ForgotScreen, LoginScreen } from '../features/auth/screens';
import { VisitsScreen, HistoryScreen, VisitScreen } from '../features/visits/screens';
import { HomeScreen } from '../features/home/screen';
import { SessionScreen } from '../features/sessions/screen';
import { ReportScreen } from '../features/reports/screen';
import { AccountScreen, ProfileScreen } from '../features/profile/screens';
import { ProviderScheduleScreen, TimeOffScreen } from '../features/availability/screen';
import { BookingRequestsScreen } from '../features/booking-requests/screen';
import { KeptDepositsScreen } from '../features/earnings/screen';
import { CertificatesScreen } from '../features/profile/certificates-screen';
import { SecuritySessionsScreen } from '../features/profile/sessions-screen';
import { useReducedMotion } from '../core/accessibility';
import { WorkShiftScreen } from '../features/work-shifts/screens';
import { RegisterShiftScreen } from '../features/work-shifts/board';
import { WorkScheduleScreen } from '../features/availability/work-schedule-screen';
import {
  NotificationBanner,
  NotificationBell,
  NotificationProvider,
  NotificationsScreen,
} from '../features/notifications/screens';
const Stack = createNativeStackNavigator<Routes & { Login: undefined }>();
const Tab = createBottomTabNavigator<MainTabs>();
const navRef = createNavigationContainerRef<Routes & { Login: undefined }>();
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.line,
    notification: colors.primary,
  },
};
function Tabs() {
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const extraTabHeight = Math.max(0, fontScale - 1) * 56;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: BrandTitle,
        headerStyle: [
          styles.header,
          fontScale > 1 ? { height: 56 + insets.top + (fontScale - 1) * 32 } : undefined,
        ],
        headerTitleContainerStyle: styles.headerTitle,
        headerRightContainerStyle: styles.headerRight,
        headerRight: () => <NotificationBell onPress={() => navRef.navigate('Notifications')} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.pale,
        tabBarStyle: [styles.tabBar, { height: 76 + extraTabHeight + insets.bottom }],
        tabBarItemStyle: styles.tabItem,
        tabBarButton: (props) => <RoundedTabButton {...props} />,
        tabBarLabelStyle: styles.tabLabel,
        tabBarLabel: ({ color, children }) => (
          <Txt numberOfLines={2} style={[styles.tabLabel, { color }]}>
            {children}
          </Txt>
        ),
        tabBarLabelPosition: 'below-icon',
        tabBarIcon: ({ color, size, focused }) => (
          <ToolbarTabIcon
            name={
              route.name === 'Home'
                ? 'home'
                : route.name === 'Schedule'
                  ? 'clipboard'
                  : route.name === 'Availability'
                    ? 'calendar'
                    : 'user'
            }
            color={color}
            size={size}
            focused={focused}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('today'), tabBarButtonTestID: 'home-tab' }}
      />
      <Tab.Screen
        name="Schedule"
        component={VisitsScreen}
        options={{ title: t('assignedVisits') }}
      />
      <Tab.Screen
        name="Availability"
        component={WorkScheduleScreen}
        options={{ title: t('workScheduleTitle') }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('profile') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.bg },
  headerTitle: { left: 16, right: 80 },
  headerRight: { paddingRight: 16 },
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    borderRadius: 24,
    marginHorizontal: 8,
    marginBottom: 6,
    paddingTop: 4,
    paddingHorizontal: 4,
    elevation: 5,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  tabItem: { borderRadius: 16, overflow: 'hidden', marginHorizontal: 1, marginBottom: 3 },
  tabLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    flexShrink: 1,
  },
});
export function AppNavigator() {
  const { api, t } = useApp();
  const reducedMotion = useReducedMotion();
  const status = api.state.status;
  if (status === 'booting' || status === 'restoreError')
    return (
      <Screen>
        <View style={{ paddingTop: 100, gap: 20 }}>
          <Title>{t(status === 'booting' ? 'restore' : 'app')}</Title>
          {status === 'booting' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Card>
              <Txt>{t('restoreHint')}</Txt>
              <Button label={t('retry')} onPress={() => void api.restore()} />
              <Button kind="secondary" label={t('logout')} onPress={() => void api.logout()} />
            </Card>
          )}
        </View>
      </Screen>
    );
  const signed = status === 'signedIn';
  const navigator = (
    <NavigationContainer key={`${signed}-${api.epoch}`} ref={navRef} theme={theme}>
      <View style={{ flex: 1 }}>
        {signed && <NotificationBanner onPress={() => navRef.navigate('Notifications')} />}
        <Stack.Navigator
          screenOptions={{
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700' },
            headerTintColor: colors.primary,
            headerBackTitle: t('back'),
            animation: reducedMotion ? 'none' : 'default',
          }}
        >
          {signed ? (
            <>
              <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="History"
                component={HistoryScreen}
                options={{ title: t('history') }}
              />
              <Stack.Screen name="Visit" component={VisitScreen} options={{ title: t('detail') }} />
              <Stack.Screen
                name="Session"
                component={SessionScreen}
                options={{ title: t('careDetails') }}
              />
              <Stack.Screen
                name="Report"
                component={ReportScreen}
                options={{ title: t('report') }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ title: t('notifications'), headerTitleAlign: 'center' }}
              />
              <Stack.Screen
                name="Account"
                component={AccountScreen}
                options={{ title: t('account') }}
              />
              <Stack.Screen
                name="BookingRequests"
                component={BookingRequestsScreen}
                options={{ title: t('shellRequests') }}
              />
              <Stack.Screen
                name="KeptDeposits"
                component={KeptDepositsScreen}
                options={{ title: t('keptDeposits') }}
              />
              <Stack.Screen
                name="TimeOff"
                component={TimeOffScreen}
                options={{ title: t('timeOffTitle') }}
              />
              <Stack.Screen
                name="Certificates"
                component={CertificatesScreen}
                options={{ title: t('certificates') }}
              />
              <Stack.Screen
                name="SecuritySessions"
                component={SecuritySessionsScreen}
                options={{ title: t('shellSecurity') }}
              />
              <Stack.Screen
                name="ProviderSchedule"
                component={ProviderScheduleScreen}
                options={{ title: t('providerSchedule') }}
              />
              <Stack.Screen
                name="RegisterShift"
                component={RegisterShiftScreen}
                options={{ title: t('workShiftRegisterAction') }}
              />
              <Stack.Screen
                name="WorkShift"
                component={WorkShiftScreen}
                options={{ title: t('workShiftDetails') }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="Forgot"
                component={ForgotScreen}
                options={{ title: t('forgotTitle') }}
              />
            </>
          )}
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
  return signed ? (
    <NotificationProvider key={api.epoch}>{navigator}</NotificationProvider>
  ) : (
    navigator
  );
}
