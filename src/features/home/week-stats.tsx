import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { addDays, formatInstant, mondayOf } from '../../core/time';
import { Card, IconButton, RemoteState, Row, Txt, colors } from '../../core/ui';
import { AvailabilityRepository } from '../availability/repository';
import { VisitRepository } from '../visits/repository';
import { weekFigures } from './week-model';

const segments = [
  { key: 'completed', color: colors.primary, label: 'weekClosedHours' },
  { key: 'upcoming', color: colors.info, label: 'weekUpcomingHours' },
  { key: 'missed', color: colors.danger, label: 'weekMissedHours' },
] as const;

export function WeekStats({ today }: { today: string }) {
  const { api, t, locale } = useApp();
  const visits = useMemo(() => new VisitRepository(api), [api]);
  const schedules = useMemo(() => new AvailabilityRepository(api), [api]);
  const [week, setWeek] = useState(0);
  const [index, setIndex] = useState<number>();
  const from = addDays(mondayOf(today), week * 7);
  const to = addDays(from, 6);
  const remote = useRemote(
    useCallback(async () => {
      const [items, slots] = await Promise.all([
        visits.allVisits(from, to),
        schedules.allSchedules(),
      ]);
      return weekFigures(from, items, slots);
    }, [visits, schedules, from, to]),
  );
  const days = remote.data ?? [];
  const totalMinutes = (item: (typeof days)[number]) =>
    item.completed + item.upcoming + item.missed;
  const maximum = Math.max(60, ...days.map((item) => Math.max(item.available, totalMinutes(item))));
  const total = days.reduce((sum, item) => sum + totalMinutes(item), 0);
  const available = days.reduce((sum, item) => sum + item.available, 0);
  const hours = (minutes: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60);
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    formatInstant(date + 'T00:00:00Z', locale, { ...options, timeZone: 'UTC' });
  const shortDate = (date: string) => format(date, { month: 'short', day: 'numeric' });
  const current = days[index ?? (week === 0 ? days.findIndex((item) => item.day === today) : 0)];
  function move(amount: number) {
    setWeek((value) => value + amount);
    setIndex(undefined);
  }
  return (
    <>
      <Row>
        <View style={styles.heading}>
          <Txt accessibilityRole="header" style={styles.title}>
            {t(week === 0 ? 'weekThis' : 'weekStats')}
          </Txt>
          <Txt muted>
            {shortDate(from)} – {shortDate(to)}
          </Txt>
        </View>
        <IconButton label={t('workPreviousWeek')} icon="chevron-left" onPress={() => move(-1)} />
        <IconButton label={t('workNextWeek')} icon="chevron-right" onPress={() => move(1)} />
      </Row>
      <RemoteState {...remote} retry={remote.reload}>
        {days.length > 0 && (
          <Card>
            <View style={styles.metrics}>
              {[
                ['weekVisitCount', days.reduce((sum, item) => sum + item.count, 0)],
                ['weekBookedHours', hours(total)],
                ['weekClosedCount', days.reduce((sum, item) => sum + item.done, 0)],
              ].map(([label, value]) => (
                <View key={label} style={styles.metric}>
                  <Txt style={styles.value}>{value}</Txt>
                  <Txt muted>{t(String(label))}</Txt>
                </View>
              ))}
            </View>
            {available > 0 && (
              <Txt muted>
                {t('weekFill').replace(
                  '{percent}',
                  String(Math.min(100, Math.round((total / available) * 100))),
                )}
              </Txt>
            )}
            {!total && !available && <Txt muted>{t('weekEmpty')}</Txt>}
            <View style={styles.chart}>
              {days.map((item, i) => (
                <Pressable
                  key={item.day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current?.day === item.day }}
                  accessibilityLabel={
                    format(item.day, { dateStyle: 'full' }) +
                    ', ' +
                    t('weekBookedHours') +
                    ' ' +
                    hours(totalMinutes(item))
                  }
                  onPress={() => setIndex(i)}
                  style={[styles.column, current?.day === item.day && styles.selected]}
                >
                  <View style={styles.track}>
                    {segments.map(({ key, color }) => (
                      <View
                        key={key}
                        style={{ backgroundColor: color, height: (item[key] / maximum) * 64 }}
                      />
                    ))}
                  </View>
                  <Txt style={styles.weekday}>{format(item.day, { weekday: 'short' })}</Txt>
                </Pressable>
              ))}
            </View>
            {current && (
              <View accessibilityLiveRegion="polite" style={styles.detail}>
                <Txt style={styles.title}>{shortDate(current.day)}</Txt>
                {segments.map(({ key, label }) => (
                  <Txt key={key} muted>
                    {t(label)} · {hours(current[key])}
                  </Txt>
                ))}
                <Txt muted>
                  {t('weekAvailableHours')} · {hours(current.available)}
                </Txt>
              </View>
            )}
          </Card>
        )}
      </RemoteState>
    </>
  );
}
const styles = StyleSheet.create({
  heading: { flex: 1 },
  title: { fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: 80 },
  value: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: colors.primary },
  chart: { flexDirection: 'row', gap: 2 },
  column: { flex: 1, minHeight: 48, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  selected: { backgroundColor: colors.pale },
  weekday: { fontSize: 12, textAlign: 'center' },
  track: {
    width: 16,
    height: 64,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  detail: { gap: 4, borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 10 },
});
