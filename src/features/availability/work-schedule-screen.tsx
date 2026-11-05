import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { MainTabs, WorkScheduleSection } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { PageHeader, Screen, Txt, colors } from '../../core/ui';
import { ShiftRegistrationBoard } from '../work-shifts/board';
import { AvailabilityAgenda } from './agenda';
import { TimeOffScreen } from './time-off-screen';

const sections: {
  value: WorkScheduleSection;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { value: 'agenda', label: 'workAgenda', icon: 'calendar' },
  { value: 'register', label: 'workRegisterTab', icon: 'edit-3' },
  { value: 'timeOff', label: 'timeOffTitle', icon: 'sun' },
];

export function WorkScheduleScreen() {
  const { t } = useApp();
  const route = useRoute<RouteProp<MainTabs, 'Availability'>>();
  const navigation = useNavigation<NavigationProp<MainTabs, 'Availability'>>();
  const [section, setSection] = useState<WorkScheduleSection>(route.params?.section ?? 'agenda');
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (route.params?.section && !locked) {
      setSection(route.params.section);
      navigation.setParams({ section: undefined });
    }
  }, [route.params?.section, locked, navigation]);
  const header = (
    <>
      <PageHeader title={t('workScheduleTitle')} />
      <View style={styles.tabs}>
        {sections.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={t(item.label)}
            accessibilityState={{ selected: section === item.value, disabled: locked }}
            disabled={locked}
            onPress={() => setSection(item.value)}
            style={({ pressed }) => [
              styles.tab,
              section === item.value && styles.activeTab,
              pressed && styles.pressed,
              locked && styles.disabled,
            ]}
          >
            <Feather
              name={item.icon}
              size={19}
              color={section === item.value ? colors.white : colors.muted}
              accessible={false}
            />
            <Txt style={[styles.label, section === item.value && styles.activeLabel]}>
              {t(item.label)}
            </Txt>
          </Pressable>
        ))}
      </View>
    </>
  );
  if (section === 'timeOff')
    return <TimeOffScreen header={header} onInteractionLockChange={setLocked} />;
  return (
    <Screen key={section}>
      {header}
      {section === 'agenda' ? <AvailabilityAgenda /> : <ShiftRegistrationBoard />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.pale,
    borderRadius: 18,
    padding: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  activeTab: { backgroundColor: colors.primary },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
    flexShrink: 1,
  },
  activeLabel: { color: colors.white },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
