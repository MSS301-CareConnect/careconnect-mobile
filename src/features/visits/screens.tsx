// @refresh reset
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
  colors,
} from '../../core/ui';
import { MainTabs, Props, VisitListRange } from '../../app/routes';
import { BookingRequestsContent } from '../booking-requests/screen';
import { useBookingRequestCount } from '../booking-requests/use-request-count';
import { VisitRepository } from './repository';
import { VisitActionPanel } from './action-panel';
import { useVietnamDay as useDay } from '../../core/use-vietnam-day';
import { BookingGroupCard } from './card';
import { groupVisitsByBooking, statuses } from './models';
import { VisitWithdrawSection } from './withdraw';
import { RecipientCard } from './recipient-profile';
import { AddressActions } from './address-actions';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new VisitRepository(api), [api]);
}
export function VisitsScreen() {
  const route = useRoute<RouteProp<MainTabs, 'Schedule'>>();
  const navigation = useNavigation<NavigationProp<MainTabs, 'Schedule'>>();
  const consumeRange = useCallback(
    () => navigation.setParams({ range: undefined, bookingId: undefined }),
    [navigation],
  );
  return (
    <VisitList
      history={false}
      requestedRange={route.params?.range}
      requestedBookingId={route.params?.bookingId}
      consumeRange={consumeRange}
    />
  );
}
export function HistoryScreen() {
  return <VisitList history />;
}
function VisitList({
  history,
  requestedRange,
  requestedBookingId,
  consumeRange,
}: {
  history: boolean;
  requestedRange?: VisitListRange;
  requestedBookingId?: string;
  consumeRange?: () => void;
}) {
  const { t } = useApp();
  const reducedMotion = useReducedMotion();
  const repo = useRepo();
  const requests = useBookingRequestCount();
  const day = useDay();
  const [range, setRange] = useState<string>(requestedRange ?? 'upcoming');
  const [bookingId, setBookingId] = useState(requestedBookingId);
  const [responseLocked, setResponseLocked] = useState(false);
  const [requestRefresh, setRequestRefresh] = useState(0);
  const responding = !history && range === 'respond';
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
    setBookingId(requestedBookingId);
    setDates({});
    setStatus('');
    setPage(0);
    setFilter(false);
    consumeRange?.();
  }, [history, requestedRange, requestedBookingId, consumeRange]);
  const toConfirm = useRemote(
    useCallback(() => repo.visits(0, day, undefined, 'SCHEDULED'), [repo, day]),
  );
  const valid =
    (!from || (/^\d{4}-\d{2}-\d{2}$/.test(from) && !Number.isNaN(Date.parse(from)))) &&
    (!to || (/^\d{4}-\d{2}-\d{2}$/.test(to) && !Number.isNaN(Date.parse(to)))) &&
    (!from || !to || from <= to);
  const load = useCallback(
    () =>
      repo.visits(
        p,
        showHistory
          ? undefined
          : responding
            ? day
            : (dates.from ?? (range === 'all' ? undefined : day)),
        showHistory || responding ? undefined : (dates.to ?? (range === 'today' ? day : undefined)),
        responding ? 'SCHEDULED' : showHistory ? 'COMPLETED' : status || undefined,
      ),
    [repo, p, showHistory, responding, dates, range, day, status],
  );
  const remote = useRemote(load);
  const showCenter = !responding || remote.loading || !!remote.error || !!remote.data?.items.length;
  const reloadRequests = requests.reload;
  const reloadToConfirm = toConfirm.reload;
  const refreshResponse = useCallback(() => {
    void reloadRequests();
    void reloadToConfirm();
  }, [reloadRequests, reloadToConfirm]);
  const responseCount =
    requests.error || toConfirm.error || requests.data === undefined || !toConfirm.data
      ? undefined
      : requests.data + toConfirm.data.totalElements;
  return (
    <Screen>
      <Row>
        <View style={styles.grow}>
          <Title>{t(showHistory ? 'history' : 'assignedVisits')}</Title>
        </View>
        {!showHistory && !responding && (
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
          disabled={remote.loading || responseLocked}
          onPress={() => {
            void remote.reload();
            refreshResponse();
            setRequestRefresh((value) => value + 1);
          }}
        />
      </Row>
      {!history && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.toolbar}>
            {['respond', 'today', 'upcoming', 'all', 'history'].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === value, disabled: responseLocked }}
                disabled={responseLocked}
                onPress={() => {
                  setRange(value);
                  setBookingId(undefined);
                  setDates({});
                  setStatus('');
                  setPage(0);
                }}
                style={({ pressed }) => [
                  styles.toolbarTab,
                  range === value && styles.toolbarActive,
                  pressed && styles.pressed,
                ]}
              >
                <Txt style={[styles.toolbarLabel, range === value && styles.toolbarActiveLabel]}>
                  {t(value)}
                </Txt>
                {value === 'respond' && responseCount !== undefined && responseCount > 0 && (
                  <View style={styles.responseBadge}>
                    <Txt
                      accessibilityLiveRegion="polite"
                      accessibilityLabel={t('respond') + ': ' + responseCount}
                      style={styles.responseBadgeText}
                    >
                      {responseCount}
                    </Txt>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      {responding && (
        <BookingRequestsContent
          embedded
          bookingId={bookingId}
          refreshKey={requestRefresh}
          onChanged={refreshResponse}
          onLockedChange={setResponseLocked}
        />
      )}
      {responding && showCenter && (
        <View style={styles.responseHeading}>
          <Txt style={styles.responseTitle}>{t('responseFromCenter')}</Txt>
          <Txt muted>{t('responseFromCenterHint')}</Txt>
        </View>
      )}
      {!showHistory && !responding && !!(dates.from || dates.to || status) && (
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
      {showCenter && (
        <RemoteState {...remote} retry={remote.reload}>
          {remote.data && (
            <>
              {remote.data.items.length ? (
                groupVisitsByBooking(remote.data.items).map((group) => (
                  <BookingGroupCard key={group.bookingId} group={group} />
                ))
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
      )}
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
              <AddressActions key={visit.address} address={visit.address} />
              {/^\+?[\d\s-]{9,16}$/.test(visit.phone) && (
                <Button
                  kind="secondary"
                  icon="phone"
                  label={t('call')}
                  onPress={() => Linking.openURL('tel:' + visit.phone)}
                />
              )}
            </Section>
            <VisitWithdrawSection visit={visit} repo={repo} reload={remote.reload} />
            <RecipientCard visit={visit} repo={repo} />
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
  toolbar: { flexDirection: 'row', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  toolbarTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  toolbarActive: { borderBottomColor: colors.primary },
  toolbarLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.muted },
  toolbarActiveLabel: { color: colors.primary },
  responseBadge: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
  },
  responseBadgeText: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.warning },
  responseHeading: { gap: 4, paddingTop: 8 },
  responseTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  grow: { flex: 1 },
  heading: { gap: 8 },
  label: { fontWeight: '700' },
});
