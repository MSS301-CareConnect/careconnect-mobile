// @refresh reset
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { addDays, formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
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
import { BookingGroupCard, VisitCard } from './card';
import { groupVisitsByBooking } from './models';
import { VisitWithdrawSection } from './withdraw';
import { RecipientCard } from './recipient-profile';
import { AddressActions } from './address-actions';
import { VisitAbsence } from '../absences/visit-absence';
import { AbsencePanel } from '../absences/panel';
import { VisitDateFilter } from './date-filter';
import { displayVisitDate, VisitDateFields, VisitPeriod, visitPeriodBounds } from './period';

const visitTabs: VisitListRange[] = ['respond', 'today', 'upcoming', 'all', 'cancelled'];
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
      requestedRange={route.params?.range}
      requestedBookingId={route.params?.bookingId}
      consumeRange={consumeRange}
    />
  );
}
export function HistoryScreen() {
  return <VisitList cancelledOnly />;
}
function VisitList({
  cancelledOnly = false,
  requestedRange,
  requestedBookingId,
  consumeRange,
}: {
  cancelledOnly?: boolean;
  requestedRange?: VisitListRange;
  requestedBookingId?: string;
  consumeRange?: () => void;
}) {
  const { t } = useApp();
  const repo = useRepo();
  const requests = useBookingRequestCount();
  const day = useDay();
  const [range, setRange] = useState<VisitListRange>(requestedRange ?? 'upcoming');
  const [bookingId, setBookingId] = useState(requestedBookingId);
  const [responseLocked, setResponseLocked] = useState(false);
  const [requestRefresh, setRequestRefresh] = useState(0);
  const responding = !cancelledOnly && range === 'respond';
  const cancelled = cancelledOnly || range === 'cancelled';
  const upcoming = !cancelledOnly && range === 'upcoming';
  const today = !cancelledOnly && range === 'today';
  const [period, setPeriod] = useState<VisitPeriod>();
  const [custom, setCustom] = useState<VisitDateFields>();
  const [p, setPage] = useState(0);
  useEffect(() => {
    if (cancelledOnly || !requestedRange) return;
    setRange(requestedRange);
    setBookingId(requestedBookingId);
    setCustom(undefined);
    setPeriod(undefined);
    setPage(0);
    consumeRange?.();
  }, [cancelledOnly, requestedRange, requestedBookingId, consumeRange]);
  const toConfirm = useRemote(
    useCallback(() => repo.visits(0, day, undefined, 'SCHEDULED'), [repo, day]),
  );
  const selectedPeriod = period ?? (cancelled ? 'month' : undefined);
  const dates = custom ?? {
    from: displayVisitDate(upcoming ? day : addDays(day, -30)),
    to: displayVisitDate(upcoming ? addDays(day, 30) : day),
  };
  const bounds = visitPeriodBounds(selectedPeriod, day, dates);
  const from =
    responding || today || (upcoming && (!bounds.from || bounds.from < day)) ? day : bounds.from;
  const to = responding ? undefined : today ? day : bounds.to;
  const status = responding ? 'SCHEDULED' : cancelled ? 'CANCELLED' : undefined;
  const dateError = bounds.error;
  const load = useCallback(
    () =>
      dateError
        ? Promise.resolve(undefined)
        : from && to && from > to
          ? Promise.resolve({ items: [], page: 0, totalPages: 0, totalElements: 0 })
          : repo.visits(p, from, to, status),
    [repo, p, dateError, from, to, status],
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
          <Title>{t(cancelledOnly ? 'CANCELLED' : 'assignedVisits')}</Title>
        </View>
        <IconButton
          label={t('refresh')}
          icon="refresh-cw"
          disabled={remote.loading || responseLocked || !!dateError}
          onPress={() => {
            void remote.reload();
            refreshResponse();
            setRequestRefresh((value) => value + 1);
          }}
        />
      </Row>
      {!cancelledOnly && <AbsencePanel refreshKey={requestRefresh} />}
      {!cancelledOnly && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.toolbar}>
            {visitTabs.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === value, disabled: responseLocked }}
                disabled={responseLocked}
                onPress={() => {
                  setRange(value);
                  setBookingId(undefined);
                  setCustom(undefined);
                  setPeriod(undefined);
                  setPage(0);
                }}
                style={({ pressed }) => [
                  styles.toolbarTab,
                  range === value && styles.toolbarActive,
                  pressed && styles.pressed,
                ]}
              >
                <Txt style={[styles.toolbarLabel, range === value && styles.toolbarActiveLabel]}>
                  {t(value === 'cancelled' ? 'CANCELLED' : value)}
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
      {!responding && !today && (
        <VisitDateFilter
          key={range}
          period={selectedPeriod}
          dates={dates}
          error={dateError}
          onChange={(value) => {
            setPeriod(value);
            setPage(0);
          }}
          onDates={(value) => {
            setCustom(value);
            setPage(0);
          }}
          onReset={
            cancelled
              ? undefined
              : () => {
                  setPeriod(undefined);
                  setCustom(undefined);
                  setPage(0);
                }
          }
        />
      )}
      {showCenter && !dateError && (
        <RemoteState {...remote} retry={remote.reload}>
          {remote.data && (
            <>
              {remote.data.items.length ? (
                cancelled ? (
                  remote.data.items.map((visit) => <VisitCard key={visit.id} visit={visit} />)
                ) : (
                  groupVisitsByBooking(remote.data.items).map((group) => (
                    <BookingGroupCard key={group.bookingId} group={group} />
                  ))
                )
              ) : (
                <Card>
                  <Txt>{t(cancelled ? 'visitCancelledEmpty' : 'emptyVisits')}</Txt>
                  {!cancelled && <Txt muted>{t('emptyHint')}</Txt>}
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
      <RemoteState
        loading={remote.loading && !visit}
        error={visit ? undefined : remote.error}
        retry={remote.reload}
      >
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
            <VisitWithdrawSection
              visit={visit}
              repo={repo}
              reload={remote.reload}
              unavailable={remote.loading || !!remote.error}
            />
            {['CAREGIVER_MISSED', 'MISSED'].includes(visit.status) && (
              <VisitAbsence bookingId={visit.bookingId} occurrenceId={visit.id} />
            )}
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
