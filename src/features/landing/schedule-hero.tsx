import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { useApp } from '../../core/app-context';

const scheduleIllustrations = {
  vi: require('../../../assets/images/landing-schedule-vi.png'),
  en: require('../../../assets/images/landing-schedule-en.png'),
} as const;

export function ScheduleHero({ height }: { height: number }) {
  const { locale } = useApp();

  return (
    <Image
      source={scheduleIllustrations[locale]}
      accessible={false}
      importantForAccessibility="no"
      resizeMode="contain"
      fadeDuration={0}
      style={[styles.illustration, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  illustration: { width: '100%' },
});
