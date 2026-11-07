// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { useVietnamDay as useDay } from '../../core/use-vietnam-day';
import { formatInstant } from '../../core/time';
import {
  Button,
  Card,
  ErrorBox,
  Pagination,
  RemoteState,
  Screen,
  Txt,
  colors,
} from '../../core/ui';
import { VisitRepository } from '../visits/repository';
import { VisitCard } from '../visits/card';
import { CareBanner } from './care-banner';
import { useBookingRequestCount } from '../booking-requests/use-request-count';

export function HomeScreen() {
  const { api, t, user, locale } = useApp();
  const repo = useMemo(() => new VisitRepository(api), [api]);
  const requests = useBookingRequestCount();
  const day = useDay();
  const previousDay = useRef(day);
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(() => repo.today(new Date(day + 'T12:00:00+07:00'), p), [repo, p, day]),
  );
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  useEffect(() => {
    if (previousDay.current !== day) {
      previousDay.current = day;
      setPage(0);
    }
  }, [day]);
  useEffect(() => {
    if (remote.data && p > 0 && p >= remote.data.visits.totalPages)
      setPage(Math.max(0, remote.data.visits.totalPages - 1));
  }, [remote.data, p]);

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.greeting}>
        <Txt muted>
          {t('hello')}
          {user?.fullName ? ', ' + user.fullName : ''}
        </Txt>
        <Txt accessibilityRole="header" style={styles.title}>
          {t('todayVisits')}
        </Txt>
        <View style={styles.date}>
          <Feather name="calendar" size={17} color={colors.primary} accessible={false} />
          <Txt muted style={styles.dateText}>
            {formatInstant(day + 'T12:00:00+07:00', locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Asia/Ho_Chi_Minh',
            })}
          </Txt>
        </View>
      </View>

      <CareBanner />

      <View style={styles.stats}>
        {(
          [
            { label: 'today', value: remote.data?.visits.totalElements, icon: 'calendar' },
            { label: 'completed', value: remote.data?.completed, icon: 'check-circle' },
          ] as const
        ).map((stat) => (
          <Card key={stat.label} style={styles.statCard}>
            <Feather name={stat.icon} size={26} color={colors.primary} accessible={false} />
            <View style={styles.statContent}>
              <Txt style={styles.statLabel}>{t(stat.label)}</Txt>
              <Txt
                accessibilityLabel={t(stat.label) + ': ' + (stat.value ?? t('loading'))}
                style={styles.statValue}
              >
                {stat.value ?? '—'}
              </Txt>
            </View>
          </Card>
        ))}
      </View>

      {(requests.data === undefined && requests.loading) ||
      requests.error ||
      (requests.data ?? 0) > 0 ? (
        <Card style={styles.attentionCard}>
          <Txt accessibilityRole="header" style={styles.attentionTitle}>
            {t('homeActionNeeded')}
          </Txt>
          {requests.error ? (
            <ErrorBox error={requests.error} retry={requests.reload} />
          ) : requests.data === undefined ? (
            <Txt muted>{t('loading')}</Txt>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                nav.navigate('Tabs', { screen: 'Schedule', params: { range: 'respond' } })
              }
              style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}
            >
              <View style={styles.attentionIcon}>
                <Feather name="clipboard" size={22} color={colors.warning} accessible={false} />
              </View>
              <Txt accessibilityLiveRegion="polite" style={styles.attentionText}>
                {t(requests.data === 1 ? 'homePendingRequestOne' : 'homePendingRequests').replace(
                  '{count}',
                  String(requests.data),
                )}
              </Txt>
              <View style={styles.reply}>
                <Txt style={styles.viewAllText}>{t('homeReply')}</Txt>
                <Feather name="chevron-right" size={18} color={colors.primary} accessible={false} />
              </View>
            </Pressable>
          )}
        </Card>
      ) : null}

      <View style={styles.scheduleHeading}>
        <Txt accessibilityRole="header" style={styles.sectionTitle}>
          {t('homeStartingSoon')}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewAllVisits')}
          onPress={() => nav.navigate('Tabs', { screen: 'Schedule', params: { range: 'today' } })}
          style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
        >
          <Txt style={styles.viewAllText}>{t('viewAllVisits')}</Txt>
          <Feather name="arrow-right" size={18} color={colors.primary} accessible={false} />
        </Pressable>
      </View>
      {remote.data && <ErrorBox error={remote.error} retry={remote.reload} />}
      <RemoteState
        loading={remote.loading && !remote.data}
        error={remote.data ? undefined : remote.error}
        retry={remote.reload}
      >
        {remote.data && (
          <>
            {remote.data.visits.totalElements === 0 ? (
              <Card style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="sun" size={25} color={colors.primary} accessible={false} />
                </View>
                <Txt accessibilityRole="header" style={styles.emptyTitle}>
                  {t('homeEmptyTitle')}
                </Txt>
                <Txt muted style={styles.emptyHint}>
                  {t('homeEmptyHint')}
                </Txt>
                <View style={styles.emptyActions}>
                  <Button
                    label={t('homeRegister')}
                    onPress={() =>
                      nav.navigate('Tabs', {
                        screen: 'Availability',
                        params: { section: 'register' },
                      })
                    }
                  />
                  <Button
                    label={t('homeUpcoming')}
                    kind="secondary"
                    onPress={() =>
                      nav.navigate('Tabs', { screen: 'Schedule', params: { range: 'upcoming' } })
                    }
                  />
                </View>
              </Card>
            ) : (
              remote.data.visits.items.map((visit) => <VisitCard key={visit.id} visit={visit} />)
            )}
            {remote.data.visits.totalPages > 1 && (
              <Pagination {...remote.data.visits} onChange={setPage} />
            )}
          </>
        )}
      </RemoteState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 16, paddingTop: 12 },
  attentionCard: { padding: 14, gap: 10 },
  attentionTitle: { fontSize: 17, lineHeight: 25, fontWeight: '700' },
  attentionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: 12,
  },
  attentionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionText: { flex: 1, minWidth: 140, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  greeting: { gap: 4 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dateText: { fontSize: 14, lineHeight: 22, flexShrink: 1 },
  stats: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  statCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    padding: 14,
    gap: 12,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: colors.pale,
  },
  statContent: { flex: 1, minWidth: 0, gap: 2 },
  statLabel: { fontSize: 14, lineHeight: 20, color: colors.muted, fontWeight: '500' },
  statValue: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: colors.primary },
  scheduleHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: '800' },
  viewAll: {
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  viewAllText: { fontSize: 14, lineHeight: 22, fontWeight: '700', color: colors.primary },
  emptyCard: {
    minHeight: 224,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pressed: { opacity: 0.7 },
});
