import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Info,
  IconButton,
  Pagination,
  RemoteState,
  Row,
  Screen,
  Section,
  Title,
  Txt,
} from '../../core/ui';
import { MainTabs, Props, Routes, VisitListRange } from '../../app/routes';
import { NavigationRow } from '../../core/navigation-row';
import { VisitRepository } from './repository';
import { VisitActionPanel } from './action-panel';
import { useVietnamDay as useDay } from '../../core/use-vietnam-day';
import { VisitCard } from './card';
import { statuses } from './models';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new VisitRepository(api), [api]);
}
export function VisitsScreen() {
  const route = useRoute<RouteProp<MainTabs, 'Schedule'>>();
  const navigation = useNavigation<NavigationProp<MainTabs, 'Schedule'>>();
  const consumeRange = useCallback(() => navigation.setParams({ range: undefined }), [navigation]);
  return (
    <VisitList history={false} requestedRange={route.params?.range} consumeRange={consumeRange} />
  );
}
export function HistoryScreen() {
  return <VisitList history />;
}
function VisitList({
  history,
  requestedRange,
  consumeRange,
}: {
  history: boolean;
  requestedRange?: VisitListRange;
  consumeRange?: () => void;
}) {
  const { t } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const reducedMotion = useReducedMotion();
  const repo = useRepo();
  const day = useDay();
  const [range, setRange] = useState<string>(requestedRange ?? 'upcoming');
  const showHistory = history || range === 'history';
  const [status, setStatus] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dates, setDates] = useState<{ from?: string; to?: string }>({});
  const [filter, setFilter] = useState(false);
  const [p, setPage] = useState(0);
  useEffect(() => {
    if (history || !requestedRange) return;
    setRange(requestedRange);
    setDates({});
    setStatus('');
    setPage(0);
    setFilter(false);
    consumeRange?.();
  }, [history, requestedRange, consumeRange]);
  const valid =
    (!from || (/^\d{4}-\d{2}-\d{2}$/.test(from) && !Number.isNaN(Date.parse(from)))) &&
    (!to || (/^\d{4}-\d{2}-\d{2}$/.test(to) && !Number.isNaN(Date.parse(to)))) &&
    (!from || !to || from <= to);
  const load = useCallback(
    () =>
      repo.visits(
        p,
        showHistory ? undefined : (dates.from ?? (range === 'all' ? undefined : day)),
        showHistory ? undefined : (dates.to ?? (range === 'today' ? day : undefined)),
        showHistory ? 'COMPLETED' : status || undefined,
      ),
    [repo, p, showHistory, dates, range, day, status],
  );
  const remote = useRemote(load);
  return (
    <Screen>
      <Row>
        <View style={styles.grow}>
          <Title>{t(showHistory ? 'history' : 'assignedVisits')}</Title>
        </View>
        {!showHistory && (
          <IconButton
            label={t('visitsFilters')}
            icon="sliders"
            onPress={() => {
              setFrom(dates.from ?? '');
              setTo(dates.to ?? '');
              setDraftStatus(status);
              setFilter(true);
            }}
          />
        )}
        <IconButton
          label={t('refresh')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={remote.reload}
        />
      </Row>
      {!history && (
        <Card>
          <NavigationRow
            label={t('shellRequests')}
            description={t('shellRequestsHint')}
            icon="inbox"
            onPress={() => navigation.navigate('BookingRequests')}
          />
        </Card>
      )}
      {!history && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chips
            values={['today', 'upcoming', 'all', 'history'].map((value) => ({
              value,
              label: t(value),
            }))}
            value={range}
            onChange={(value) => {
              setRange(value);
              setDates({});
              setStatus('');
              setPage(0);
            }}
          />
        </ScrollView>
      )}
      {!showHistory && !!(dates.from || dates.to || status) && (
        <Txt muted>{t('filtersApplied')}</Txt>
      )}
      <Modal
        visible={filter}
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setFilter(false)}
      >
        <SafeAreaView style={styles.grow} edges={['top']}>
          <Screen>
            <Row>
              <View style={styles.grow}>
                <Title>{t('visitsFilters')}</Title>
              </View>
              <IconButton label={t('close')} icon="x" onPress={() => setFilter(false)} />
            </Row>
            <Field label={t('from')} value={from} onChangeText={setFrom} maxLength={10} />
            <Field label={t('to')} value={to} onChangeText={setTo} maxLength={10} />
            <Chips
              values={['', ...statuses].map((value) => ({ value, label: t(value || 'all') }))}
              value={draftStatus}
              onChange={setDraftStatus}
            />
            <Button
              label={t('applyFilters')}
              disabled={!valid}
              onPress={() => {
                setDates({ from: from || undefined, to: to || undefined });
                setStatus(draftStatus);
                setRange('all');
                setPage(0);
                setFilter(false);
              }}
            />
            <Button
              label={t('resetFilters')}
              kind="secondary"
              onPress={() => {
                setFrom('');
                setTo('');
                setDraftStatus('');
                setDates({});
                setStatus('');
                setRange('upcoming');
                setPage(0);
                setFilter(false);
              }}
            />
          </Screen>
        </SafeAreaView>
      </Modal>
      <RemoteState {...remote} retry={remote.reload}>
        {remote.data && (
          <>
            {remote.data.items.length ? (
              remote.data.items.map((visit) => <VisitCard key={visit.id} visit={visit} />)
            ) : (
              <Card>
                <Txt>{t('emptyVisits')}</Txt>
                <Txt muted>{t('emptyHint')}</Txt>
              </Card>
            )}
            <Pagination {...remote.data} onChange={setPage} />
          </>
        )}
      </RemoteState>
    </Screen>
  );
}

export function VisitScreen({ route, navigation }: Props<'Visit'>) {
  const { t, locale } = useApp();
  const repo = useRepo();
  const remote = useRemote(useCallback(() => repo.visit(route.params.id), [repo, route.params.id]));
  const visit = remote.data;
  return (
    <Screen>
      <RemoteState {...remote} retry={remote.reload}>
        {visit && (
          <>
            <View style={styles.heading}>
              <Txt muted>{visit.bookingCode}</Txt>
              <Title>{visit.name || t('patient')}</Title>
              <Badge status={visit.status} />
              <Txt>
                {formatInstant(visit.startAt, locale)} –{' '}
                {formatInstant(visit.endAt, locale, { hour: '2-digit', minute: '2-digit' })}
              </Txt>
            </View>
            <Section title={t('address')} icon="map-pin">
              <Txt>{visit.address || '—'}</Txt>
              {/^\+?[\d\s-]{9,16}$/.test(visit.phone) && (
                <Button
                  kind="secondary"
                  icon="phone"
                  label={t('call')}
                  onPress={() => Linking.openURL('tel:' + visit.phone)}
                />
              )}
            </Section>
            <Section title={t('patient')} icon="user">
              {visit.snapshot ? (
                <>
                  {visit.snapshot.info.map((info) => (
                    <Info
                      key={info.label}
                      label={t(info.label)}
                      value={
                        ['gender', 'mobilityLevel', 'independenceLevel'].includes(info.label)
                          ? t(info.value)
                          : info.value
                      }
                    />
                  ))}
                  {visit.snapshot.medications.length > 0 && (
                    <>
                      <Txt style={styles.label}>{t('medication')}</Txt>
                      {visit.snapshot.medications.map((m, i) => (
                        <Info key={i} label={m.name} value={m.details} />
                      ))}
                    </>
                  )}
                  {visit.snapshot.emergency && (
                    <Info
                      label={t('emergency')}
                      value={`${visit.snapshot.emergency.name}\n${visit.snapshot.emergency.phone}`}
                    />
                  )}
                </>
              ) : (
                <Txt muted>{t('patientHidden')}</Txt>
              )}
            </Section>
            <Section title={t('services')} icon="heart">
              {visit.services.length ? (
                visit.services.map((value, i) => <Txt key={i}>• {value}</Txt>)
              ) : (
                <Txt muted>—</Txt>
              )}
            </Section>
            {visit.special.length > 0 && (
              <Section title={t('special')} icon="alert-circle">
                {visit.special.map((info) => (
                  <Info key={info.label} label={t(info.label)} value={info.value} />
                ))}
              </Section>
            )}
            {visit.customerNote && (
              <Section title={t('customerNote')} icon="message-circle">
                <Txt>{visit.customerNote}</Txt>
              </Section>
            )}
          </>
        )}
      </RemoteState>
      {visit && (
        <VisitActionPanel
          visit={visit}
          repo={repo}
          reload={remote.reload}
          navigation={navigation}
          unavailable={remote.loading || !!remote.error}
          readError={remote.error}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  grow: { flex: 1 },
  heading: { gap: 8 },
  label: { fontWeight: '700' },
});
