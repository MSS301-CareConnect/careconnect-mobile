import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { useVietnamDay as useDay } from '../../core/use-vietnam-day';
import { formatInstant } from '../../core/time';
import { Card, Pagination, RemoteState, Screen, Txt, colors } from '../../core/ui';
import { VisitRepository } from '../visits/repository';
import { VisitCard } from '../visits/card';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new VisitRepository(api), [api]);
}
export function HomeScreen() {
  const { t, user, locale } = useApp();
  const repo = useRepo();
  const day = useDay();
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(() => repo.today(new Date(day + 'T12:00:00+07:00'), p), [repo, p, day]),
  );
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Screen>
      <View style={styles.greeting}>
        <Txt muted>
          {t('hello')}, {user?.fullName}
        </Txt>
        <Txt style={styles.title}>{t('todayVisits')}</Txt>
        <View style={styles.date}>
          <Feather name="calendar" size={15} color={colors.muted} />
          <Txt muted style={styles.dateText}>
            {formatInstant(day + 'T05:00:00Z', locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Asia/Ho_Chi_Minh',
            })}
          </Txt>
        </View>
      </View>
      <View style={styles.banner}>
        <Image
          source={require('../../../assets/images/care-at-home-hero.jpg')}
          style={styles.bannerImage}
          accessible={false}
          resizeMode="contain"
        />
        <View pointerEvents="none" style={styles.bannerGradient} />
        <Txt style={styles.tagline}>{t('tagline')}</Txt>
      </View>
      {remote.data && !remote.loading && !remote.error && (
        <View style={styles.stats}>
          <Card style={styles.statCard}>
            <View style={styles.statLabel}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <Txt style={styles.statLabelText}>{t('today')}</Txt>
            </View>
            <Txt style={styles.statValue}>{remote.data.visits.totalElements}</Txt>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statLabel}>
              <Feather name="check-circle" size={18} color={colors.primary} />
              <Txt style={styles.statLabelText}>{t('completed')}</Txt>
            </View>
            <Txt style={styles.statValue}>{remote.data.completed}</Txt>
          </Card>
        </View>
      )}
      <View style={styles.scheduleHeading}>
        <Txt style={styles.sectionTitle}>{t('todaySchedule')}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewAllVisits')}
          onPress={() => nav.navigate('Tabs', { screen: 'Schedule' })}
          style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
        >
          <Txt style={styles.viewAllText}>{t('viewAllVisits')}</Txt>
        </Pressable>
      </View>
      <RemoteState {...remote} retry={remote.reload}>
        {remote.data && (
          <>
            {remote.data.visits.items.length ? (
              remote.data.visits.items.map((v) => <VisitCard key={v.id} visit={v} />)
            ) : (
              <Card>
                <Txt>{t('emptyVisits')}</Txt>
                <Txt muted>{t('emptyHint')}</Txt>
              </Card>
            )}
            <Pagination {...remote.data.visits} onChange={setPage} />
          </>
        )}
      </RemoteState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 4 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateText: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  banner: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    minHeight: 128,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerImage: { position: 'absolute', top: 0, right: 0, height: '100%', aspectRatio: 1.5 },
  bannerGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage:
      'linear-gradient(to right, #087443 0%, rgba(8, 116, 67, 0.98) 40%, rgba(8, 116, 67, 0.2) 72%, rgba(8, 116, 67, 0.04) 100%)',
  },
  tagline: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    color: colors.white,
    maxWidth: '55%',
  },
  stats: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  statCard: {
    flex: 1,
    minHeight: 80,
    padding: 12,
    gap: 4,
    borderRadius: 17,
    borderWidth: 0,
    backgroundColor: colors.pale,
  },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statLabelText: { fontSize: 13, lineHeight: 20, color: colors.primary, flexShrink: 1 },
  statValue: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.primary },
  scheduleHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  viewAll: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingLeft: 4 },
  viewAllText: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
});
