import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { useVietnamDay } from '../../core/use-vietnam-day';
import { formatInstant } from '../../core/time';
import { Badge, Button, Card, IconButton, RemoteState, Txt, colors } from '../../core/ui';
import { AvailabilityRepository } from './repository';
import { addDays } from './time-off';
import { agendaRows } from './agenda-model';

export function AvailabilityAgenda() {
  const { api, t, locale } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const repo = useMemo(() => new AvailabilityRepository(api), [api]);
  const today = useVietnamDay();
  const [day, setDay] = useState(today);
  const previousToday = useRef(today);
  useEffect(() => {
    if (day === previousToday.current) setDay(today);
    previousToday.current = today;
  }, [today, day]);
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(day, -weekday),
    to = addDays(from, 6);
  const remote = useRemote(useCallback(() => repo.agenda(from, to), [repo, from, to]));
  const rows = remote.data ? agendaRows(day, remote.data) : [];
  const clock = (value: number) =>
    formatInstant(new Date(value).toISOString(), locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  const shortDate = (date: string) =>
    formatInstant(`${date}T00:00:00+07:00`, locale, {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  return (
    <>
      <View style={styles.weekToolbar}>
        <View style={styles.weekNavigation}>
          <IconButton
            label={t('workPreviousWeek')}
            icon="chevron-left"
            onPress={() => setDay(addDays(day, -7))}
          />
          <Txt style={styles.weekRange}>
            {shortDate(from)} – {shortDate(to)}
          </Txt>
          <IconButton
            label={t('workNextWeek')}
            icon="chevron-right"
            onPress={() => setDay(addDays(day, 7))}
          />
        </View>
        <IconButton
          label={t('refresh')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={() => void remote.reload()}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {Array.from({ length: 7 }, (_, index) => addDays(from, index)).map((date) => (
          <Pressable
            key={date}
            accessibilityRole="tab"
            accessibilityLabel={date}
            accessibilityState={{ selected: date === day }}
            onPress={() => setDay(date)}
            style={[styles.day, date === day && styles.selectedDay]}
          >
            <Txt style={date === day ? styles.selectedText : styles.dayText}>
              {formatInstant(`${date}T00:00:00+07:00`, locale, {
                weekday: 'short',
                timeZone: 'Asia/Ho_Chi_Minh',
              })}
            </Txt>
            <Txt style={date === day ? styles.selectedText : styles.dayText}>{date.slice(8)}</Txt>
          </Pressable>
        ))}
      </ScrollView>
      <RemoteState
        loading={remote.loading && !remote.data}
        error={remote.error}
        retry={remote.reload}
      >
        {rows.length === 0 && (
          <Card>
            <Txt muted>{t('workAgendaEmpty')}</Txt>
          </Card>
        )}
        {rows.map((row) => (
          <Card key={`${row.kind}-${row.item.id}`} style={styles.card}>
            <Txt style={styles.heading}>
              {row.kind === 'visit'
                ? row.item.name || t('workVisitItem')
                : t(row.kind === 'availability' ? 'workAvailabilityItem' : 'timeOffTitle')}
            </Txt>
            <View style={styles.metadata}>
              <Feather name="calendar" size={18} color={colors.primary} accessible={false} />
              <Txt muted style={styles.metadataText}>
                {shortDate(day)} · {clock(row.start)}–{clock(row.end)}
              </Txt>
            </View>
            {row.kind === 'availability' && (
              <>
                <Badge
                  status={row.item.status === 'SCHEDULED' ? 'provider_SCHEDULED' : row.item.status}
                />
                <Button
                  label={t('viewDetails')}
                  kind="secondary"
                  onPress={() =>
                    navigation.navigate('ProviderSchedule', { scheduleId: row.item.id })
                  }
                />
              </>
            )}
            {row.kind === 'visit' && (
              <>
                {!!row.item.address && (
                  <View style={styles.metadata}>
                    <Feather name="map-pin" size={18} color={colors.muted} accessible={false} />
                    <Txt muted style={styles.metadataText}>
                      {row.item.address}
                    </Txt>
                  </View>
                )}
                <Badge status={row.item.status} />
                <Button
                  label={t('viewDetails')}
                  kind="secondary"
                  onPress={() => navigation.navigate('Visit', { id: row.item.id })}
                />
              </>
            )}
            {row.kind === 'timeOff' && (
              <>
                <Button
                  label={t('timeOffTitle')}
                  kind="secondary"
                  onPress={() =>
                    navigation.navigate('Tabs', {
                      screen: 'Availability',
                      params: { section: 'timeOff' },
                    })
                  }
                />
              </>
            )}
          </Card>
        ))}
      </RemoteState>
    </>
  );
}
const styles = StyleSheet.create({
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '800' },
  weekToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekNavigation: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
  weekRange: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  metadata: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  metadataText: { flex: 1 },
  days: { gap: 8, paddingVertical: 4 },
  day: {
    minWidth: 48,
    minHeight: 64,
    padding: 8,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectedDay: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.ink, fontWeight: '700' },
  selectedText: { color: colors.white, fontWeight: '700' },
  card: { borderRadius: 20, padding: 16, gap: 12 },
});
