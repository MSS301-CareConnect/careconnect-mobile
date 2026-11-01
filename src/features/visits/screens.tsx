import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../core/app-context';
import { useRemote, useWrite } from '../../core/hooks';
import { optionalCoordinates } from '../../core/device';
import { checkInAllowed, formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  Chips,
  ErrorBox,
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
import { Props } from '../../app/routes';
import { VisitRepository } from './repository';
import { SessionRepository } from '../sessions/repository';
import { useVietnamDay as useDay } from '../../core/use-vietnam-day';
import { VisitCard } from './card';
import { statuses } from './models';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new VisitRepository(api), [api]);
}
export function VisitsScreen() {
  return <VisitList history={false} />;
}
export function HistoryScreen() {
  return <VisitList history />;
}
function VisitList({ history }: { history: boolean }) {
  const { t } = useApp();
  const repo = useRepo();
  const day = useDay();
  const [range, setRange] = useState('upcoming');
  const showHistory = history || range === 'history';
  const [status, setStatus] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dates, setDates] = useState<{ from?: string; to?: string }>({});
  const [filter, setFilter] = useState(false);
  const [p, setPage] = useState(0);
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
        <View style={{ flex: 1 }}>
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
          onPress={() => void remote.reload()}
        />
      </Row>
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
      <Modal visible={filter} animationType="slide" onRequestClose={() => setFilter(false)}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Screen>
            <Row>
              <View style={{ flex: 1 }}>
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
  const { api } = useApp();
  const sessions = useMemo(() => new SessionRepository(api), [api]);
  const { t, locale } = useApp();
  const repo = useRepo();
  const remote = useRemote(useCallback(() => repo.visit(route.params.id), [repo, route.params.id]));
  const write = useWrite();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  async function reconcile() {
    const value = await remote.reload();
    if (value) write.reset();
  }
  const visit = remote.data;
  return (
    <Screen>
      <RemoteState {...remote} retry={remote.reload}>
        {visit && (
          <>
            <View style={{ gap: 8 }}>
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
                  onPress={() => void Linking.openURL('tel:' + visit.phone)}
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
                      <Txt style={{ fontWeight: '700' }}>{t('medication')}</Txt>
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
            <ErrorBox error={write.error} retry={reconcile} />
            {visit.sessionId ? (
              <Button
                label={t('viewSession')}
                onPress={() => navigation.navigate('Session', { id: visit.sessionId })}
              />
            ) : (
              <>
                {visit.status === 'SCHEDULED' && (
                  <Button
                    label={t('acknowledge')}
                    disabled={write.uncertain}
                    loading={write.busy}
                    onPress={() =>
                      void write.run(
                        () => repo.acknowledge(visit.id),
                        async () => {
                          await remote.reload();
                        },
                      )
                    }
                  />
                )}
                {['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) && (
                  <>
                    <Txt muted>{t('checkWindow')}</Txt>
                    <Button
                      label={t('start')}
                      icon="play"
                      disabled={write.uncertain || !checkInAllowed(visit.startAt, visit.endAt, now)}
                      loading={write.busy}
                      onPress={() =>
                        void write.run(
                          async () => sessions.start(visit.id, await optionalCoordinates()),
                          (session) => navigation.navigate('Session', { id: session.id }),
                        )
                      }
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
