import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Props } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { addDays, formatInstant, mondayOf } from '../../core/time';
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  RemoteState,
  Row,
  Screen,
  Title,
  Txt,
  confirm,
} from '../../core/ui';
import { acceptableVisits, dayWithdrawal, groupVisitDays } from './booking-days';
import { VisitCard } from './card';
import { Visit } from './models';
import { VisitRepository } from './repository';
import { WithdrawModal } from './withdraw';

export function BookingVisitsScreen({ route }: Props<'BookingVisits'>) {
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new VisitRepository(api), [api]);
  const { bookingId, code, name } = route.params;
  const remote = useRemote(useCallback(() => repo.bookingVisits(bookingId), [repo, bookingId]));
  const write = useWrite();
  const [confirming, setConfirming] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const [selectedWeek, setWeek] = useState<string>();
  const [withdrawal, setWithdrawal] = useState<{ visits: Visit[]; kept: number }>();
  const visits = remote.data ?? [];
  const groups = groupVisitDays(visits);
  const days = [...groups.keys()];
  const now = Date.now();
  const day =
    days.find((key) => groups.get(key)?.some((visit) => Date.parse(visit.endAt) > now)) ??
    days.at(-1);
  const week = selectedWeek ?? (day ? mondayOf(day) : undefined);
  const weekEnd = week ? addDays(week, 6) : undefined;
  const weekDays = week && weekEnd ? days.filter((date) => date >= week && date <= weekEnd) : [];
  const accept = acceptableVisits(visits, now);
  const withdrawalPlans = [...groups.values()].map((items) => dayWithdrawal(items, now));
  const remaining = withdrawalPlans.flatMap((plan) =>
    plan.allowed && plan.visits.length <= 60 ? plan.visits : [],
  );
  const kept =
    withdrawalPlans.reduce((count, plan) => count + plan.visits.length, 0) - remaining.length;
  const blocked = confirming || write.busy || write.uncertain || reconcile;
  useDirty(false, confirming || write.busy);

  async function reload() {
    const updated = await remote.reload();
    if (updated) {
      write.reset();
      setReconcile(false);
    }
    return updated;
  }
  async function acknowledge(items: Visit[]) {
    if (blocked || items.length < 2 || items.length > 100) return;
    setConfirming(true);
    const count = String(items.length);
    try {
      if (
        !(await confirm(
          t('acceptMany').replace('{count}', count),
          t('acceptManyConfirm'),
          t('acknowledge'),
          t('cancel'),
        ))
      )
        return;
      if (acceptableVisits(items, Date.now()).length !== items.length) {
        setReconcile(true);
        return;
      }
      await write.run(
        () => repo.acknowledgeMany(items),
        async () => {
          setReconcile(true);
          await reload();
        },
      );
    } finally {
      setConfirming(false);
    }
  }
  function acceptButton(items: Visit[]) {
    return (
      items.length > 1 && (
        <Button
          label={t('acceptMany').replace('{count}', String(Math.min(items.length, 100)))}
          disabled={blocked}
          icon="check-circle"
          kind="secondary"
          onPress={() => void acknowledge(items.slice(0, 100))}
        />
      )
    );
  }
  const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
    formatInstant(date + 'T00:00:00Z', locale, { ...options, timeZone: 'UTC' });
  const shortDate = (date: string) => formatDay(date, { month: 'short', day: 'numeric' });
  return (
    <Screen>
      <View style={styles.heading}>
        {code ? <Txt muted>{code}</Txt> : null}
        <Title>{name || visits[0]?.name || t('bookingVisitsTitle')}</Title>
      </View>
      <ErrorBox error={write.error} />
      {(write.uncertain || reconcile) && (
        <Button
          label={t('requestReconcile')}
          kind="secondary"
          loading={remote.loading}
          onPress={reload}
        />
      )}
      <RemoteState {...remote} retry={reload} empty={remote.data?.length === 0}>
        {acceptButton(accept)}
        {remaining.length > 0 && (
          <Button
            label={t('withdrawRemaining')}
            kind="secondary"
            icon="user-x"
            disabled={blocked}
            onPress={() => setWithdrawal({ visits: remaining, kept })}
          />
        )}
        {week && weekEnd && (
          <>
            <Row>
              <IconButton
                label={t('workPreviousWeek')}
                icon="chevron-left"
                onPress={() => setWeek(addDays(week, -7))}
              />
              <Txt accessibilityRole="header" style={styles.week}>
                {shortDate(week)} – {shortDate(weekEnd)}
              </Txt>
              <IconButton
                label={t('workNextWeek')}
                icon="chevron-right"
                onPress={() => setWeek(addDays(week, 7))}
              />
            </Row>
            {!weekDays.length && (
              <Card>
                <Txt muted>{t('emptyVisits')}</Txt>
              </Card>
            )}
            {weekDays.map((date) => {
              const items = groups.get(date) ?? [];
              const plan = dayWithdrawal(items, Date.now());
              const dayAccept = acceptableVisits(items, Date.now());
              const services = [...new Set(items.flatMap((item) => item.services).filter(Boolean))];
              return (
                <View key={date} style={styles.day}>
                  <Txt accessibilityRole="header" style={styles.section}>
                    {formatDay(date, { dateStyle: 'full' })}
                  </Txt>
                  <Txt muted>
                    {t('bookingGroupVisits').replace('{count}', String(items.length))}
                  </Txt>
                  {services.length > 0 && <Txt muted>{services.join(' · ')}</Txt>}
                  {dayAccept.length !== accept.length && acceptButton(dayAccept)}
                  {plan.allowed && plan.visits.length <= 60 && (
                    <Button
                      label={t(plan.visits.length > 1 ? 'withdrawDay' : 'withdrawOne')}
                      kind="secondary"
                      disabled={blocked}
                      onPress={() => setWithdrawal({ visits: plan.visits, kept: 0 })}
                    />
                  )}
                  {plan.allowed && plan.visits.length > 60 && (
                    <Txt muted>{t('withdrawDayLimit')}</Txt>
                  )}
                  {!plan.allowed && plan.visits.length > 1 && (
                    <Txt muted>{t('withdrawTooLateDay')}</Txt>
                  )}
                  {items.map((visit) => (
                    <VisitCard key={visit.id} visit={visit} />
                  ))}
                </View>
              );
            })}
          </>
        )}
      </RemoteState>
      {withdrawal && (
        <WithdrawModal
          {...withdrawal}
          repo={repo}
          onDone={reload}
          onClose={() => setWithdrawal(undefined)}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { gap: 4 },
  day: { gap: 10 },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '700', paddingTop: 10 },
  week: { flex: 1, textAlign: 'center', fontWeight: '700' },
});
