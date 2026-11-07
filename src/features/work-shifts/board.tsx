import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import {
  NavigationProp,
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabs, Routes, ShiftRegistrationView } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  Chips,
  ErrorBox,
  Field,
  IconButton,
  Pagination,
  PageHeader,
  RemoteState,
  Row,
  Screen,
  Txt,
  colors,
} from '../../core/ui';
import { ShiftFilters, WorkShiftRepository } from './repository';
import { registrationBlockReason, ShiftOverview } from './models';
import { vietnamDay } from '../../core/time';
import { validDay } from '../availability/time-off';
import { RegistrationStatus, ShiftSummary } from './card';

type RegistrationView = ShiftRegistrationView;
const registrationTabs: { value: RegistrationView; label: string }[] = [
  { value: 'open', label: 'workOpenFilter' },
  { value: 'pending', label: 'workPendingFilter' },
  { value: 'approved', label: 'workApprovedFilter' },
  { value: 'history', label: 'workHistoryFilter' },
];

const styles = StyleSheet.create({
  card: { gap: 9, padding: 16, borderRadius: 18, elevation: 1 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detailsText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  detailsLink: { minHeight: 48, paddingLeft: 8 },
  fill: { flex: 1 },
  center: { color: colors.primary, fontWeight: '700' },
  process: { flexDirection: 'row', gap: 8, padding: 16, alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 8 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.primary, fontWeight: '800' },
  stepText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  stepArrow: { marginTop: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    flex: 1,
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
  filterCount: {
    backgroundColor: colors.pale,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 6,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
  activeFilterLabel: { color: colors.white },
  emptyCard: {
    minHeight: 240,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlus: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  emptyHint: { textAlign: 'center' },
});

function RegistrationEmpty({ title, hint }: { title: string; hint: string }) {
  const { t } = useApp();
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon} importantForAccessibility="no-hide-descendants">
        <Feather name="calendar" size={42} color={colors.primary} />
        <View style={styles.emptyPlus}>
          <Feather name="plus" size={20} color={colors.white} />
        </View>
      </View>
      <Txt accessibilityRole="header" style={styles.emptyTitle}>
        {t(title)}
      </Txt>
      <Txt muted style={styles.emptyHint}>
        {t(hint)}
      </Txt>
    </Card>
  );
}
function DetailsHint({ onPress }: { onPress?: () => void }) {
  const { t } = useApp();
  const content = (
    <>
      <Txt style={styles.detailsText}>{t('viewDetails')}</Txt>
      <Feather name="chevron-right" size={16} color={colors.primary} accessible={false} />
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('workShiftDetails')}
      onPress={onPress}
      style={[styles.details, styles.detailsLink]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.details} accessible={false}>
      {content}
    </View>
  );
}
function NavigableShiftCard({
  shift,
  status,
  onOpen,
  children,
}: {
  shift?: ShiftOverview;
  status: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const { t, locale } = useApp();
  const label = [
    t('workShiftDetails'),
    shift
      ? formatInstant(`${shift.workDate}T00:00:00+07:00`, locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        })
      : t('workShiftUnavailable'),
    shift ? `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}` : undefined,
    status,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onOpen}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <Card style={styles.card}>{children}</Card>
    </Pressable>
  );
}

function useRepo() {
  const { api } = useApp();
  return useMemo(() => new WorkShiftRepository(api), [api]);
}
function useBoardPolling(reload: () => Promise<unknown>, busy: boolean) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || busy) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void reload();
    }, 30000);
    return () => clearInterval(timer);
  }, [focused, reload, busy]);
}
function OpenShifts({
  onOpen,
  refreshOverview,
}: {
  onOpen: (id: string) => void;
  refreshOverview?: () => Promise<unknown>;
}) {
  const { t } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const [filters, setFilters] = useState<ShiftFilters>({ fromDate: vietnamDay() });
  const [draft, setDraft] = useState<ShiftFilters>(filters);
  const [filtering, setFiltering] = useState(false);
  const validFilters =
    (!draft.fromDate || validDay(draft.fromDate)) &&
    (!draft.toDate || validDay(draft.toDate)) &&
    (!draft.fromDate || !draft.toDate || draft.fromDate <= draft.toDate);
  const remote = useRemote(
    useCallback(() => repo.board(Date.now(), p, filters), [repo, p, filters]),
  );
  useBoardPolling(remote.reload, remote.loading);
  const board = remote.data;
  const total = board?.totalElements ?? 0;
  const totalPages = board?.totalPages ?? 0;
  const items = board?.items ?? [];
  useEffect(() => {
    if (board && p > 0 && p >= board.totalPages) setPage(Math.max(0, board.totalPages - 1));
  }, [board, p]);
  return (
    <>
      <Row>
        <View style={styles.fill}>
          <Txt style={styles.center}>
            {t('workShiftsOpen')} {board ? `(${total})` : ''}
          </Txt>
        </View>
        <IconButton
          label={t('refreshWorkShifts')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={() => {
            void remote.reload();
            void refreshOverview?.();
          }}
        />
        <Button
          kind="secondary"
          label={t('workFilters')}
          onPress={() => setFiltering(!filtering)}
        />
      </Row>
      {filtering && (
        <Card>
          <Field
            label={t('workFromDate')}
            value={draft.fromDate ?? ''}
            onChangeText={(fromDate) => setDraft({ ...draft, fromDate })}
            placeholder={t('workDatePlaceholder')}
          />
          <Field
            label={t('workToDate')}
            value={draft.toDate ?? ''}
            onChangeText={(toDate) => setDraft({ ...draft, toDate })}
            placeholder={t('workDatePlaceholder')}
          />
          <Chips
            values={['', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FULL_DAY', 'CUSTOM'].map(
              (value) => ({
                value,
                label: t(value ? `workShiftType_${value}` : 'workShiftAllTypes'),
              }),
            )}
            value={draft.shiftType ?? ''}
            onChange={(shiftType) => setDraft({ ...draft, shiftType: shiftType || undefined })}
          />
          <Chips
            values={[
              { value: 'all', label: t('workShiftAnyCapacity') },
              { value: 'vacancy', label: t('workShiftVacancy') },
            ]}
            value={draft.hasVacancy ? 'vacancy' : 'all'}
            onChange={(value) => setDraft({ ...draft, hasVacancy: value === 'vacancy' })}
          />
          {!validFilters && <Txt>{t('workDateRangeInvalid')}</Txt>}
          <Button
            label={t('workApply')}
            disabled={!validFilters || remote.loading}
            onPress={() => {
              setPage(0);
              setFilters(draft);
              setFiltering(false);
            }}
          />
        </Card>
      )}
      <RemoteState {...remote} loading={remote.loading && !remote.data} retry={remote.reload}>
        {board && (
          <>
            {!board.eligible && (
              <Card>
                <Txt>{t('workShiftEligibility')}</Txt>
              </Card>
            )}
            {items.length === 0 && (
              <RegistrationEmpty
                title="workOpenEmptyTitle"
                hint={
                  filters.toDate ||
                  filters.shiftType ||
                  filters.hasVacancy ||
                  filters.fromDate !== vietnamDay()
                    ? 'workFilteredEmptyHint'
                    : 'workOpenEmptyHint'
                }
              />
            )}
            {items.map(({ shift }) => {
              const blocked = registrationBlockReason(
                shift,
                undefined,
                board.eligible,
                board.loadedAt,
              );
              const content = (
                <>
                  <ShiftSummary
                    shift={shift}
                    headerAction={<DetailsHint onPress={() => onOpen(shift.id)} />}
                    action={<Badge status="workShift_OPEN" tone="success" />}
                  />
                  {shift.note !== '' && (
                    <Txt muted numberOfLines={2}>
                      {shift.note}
                    </Txt>
                  )}
                  {blocked && <Txt muted>{t(blocked)}</Txt>}
                  <Button
                    label={t('workShiftRegisterAction')}
                    icon="edit-3"
                    disabled={!!blocked || remote.loading || !!remote.error}
                    onPress={() => onOpen(shift.id)}
                  />
                </>
              );
              return (
                <Card key={shift.id} style={styles.card}>
                  {content}
                </Card>
              );
            })}
            {totalPages > 1 && (
              <Pagination
                page={board.page}
                totalPages={totalPages}
                totalElements={total}
                onChange={setPage}
              />
            )}
          </>
        )}
      </RemoteState>
    </>
  );
}
function MyRegistrations({
  onOpen,
  status,
  refreshOverview,
}: {
  onOpen: (id: string) => void;
  status?: 'PENDING' | 'APPROVED';
  refreshOverview: () => Promise<unknown>;
}) {
  const { t } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const remote = useRemote(useCallback(() => repo.mine(p, status), [repo, p, status]));
  useBoardPolling(remote.reload, remote.loading);
  useEffect(() => {
    if (remote.data && p > 0 && p >= remote.data.totalPages)
      setPage(Math.max(0, remote.data.totalPages - 1));
  }, [remote.data, p]);
  const title =
    status === 'PENDING'
      ? 'workPendingFilter'
      : status === 'APPROVED'
        ? 'workApprovedFilter'
        : 'workHistoryFilter';
  return (
    <>
      <Row>
        <Txt style={[styles.fill, styles.center]}>
          {t(title)} {remote.data ? `(${remote.data.totalElements})` : ''}
        </Txt>
        <IconButton
          label={t('refreshRegistrations')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={() => {
            void remote.reload();
            void refreshOverview();
          }}
        />
      </Row>
      <RemoteState {...remote} loading={remote.loading && !remote.data} retry={remote.reload}>
        {remote.data && (
          <>
            {remote.data.items.length === 0 && (
              <RegistrationEmpty
                title={
                  status === 'PENDING'
                    ? 'workPendingEmptyTitle'
                    : status === 'APPROVED'
                      ? 'workApprovedEmptyTitle'
                      : 'workHistoryEmptyTitle'
                }
                hint={
                  status === 'PENDING'
                    ? 'workPendingEmptyHint'
                    : status === 'APPROVED'
                      ? 'workApprovedEmptyHint'
                      : 'workHistoryHint'
                }
              />
            )}
            {remote.data.items.map(({ registration, shift }) => (
              <NavigableShiftCard
                key={registration.id}
                shift={shift}
                status={
                  ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(registration.status)
                    ? t(`registration_${registration.status}`)
                    : registration.status
                }
                onOpen={() => onOpen(registration.workShiftId)}
              >
                {shift ? (
                  <ShiftSummary
                    shift={shift}
                    headerAction={<DetailsHint />}
                    action={<RegistrationStatus registration={registration} />}
                  />
                ) : (
                  <>
                    <Row>
                      <View style={styles.fill}>
                        <Txt muted>{t('workShiftUnavailable')}</Txt>
                      </View>
                      <DetailsHint />
                    </Row>
                    <RegistrationStatus registration={registration} />
                  </>
                )}
                {registration.caregiverNote !== '' && (
                  <Txt muted numberOfLines={2}>
                    {registration.caregiverNote}
                  </Txt>
                )}
                {registration.rejectionReason !== '' && (
                  <Txt muted numberOfLines={2}>
                    {registration.rejectionReason}
                  </Txt>
                )}
              </NavigableShiftCard>
            ))}
            {remote.data.totalPages > 1 && <Pagination {...remote.data} onChange={setPage} />}
          </>
        )}
      </RemoteState>
    </>
  );
}
export function ShiftRegistrationBoard() {
  const { t } = useApp();
  const repo = useRepo();
  const overview = useRemote(useCallback(() => repo.registrationOverview(), [repo]));
  useBoardPolling(overview.reload, overview.loading);
  const [view, setView] = useState<RegistrationView>('open');
  const route = useRoute<RouteProp<MainTabs, 'Availability'>>();
  const tabNavigation = useNavigation<NavigationProp<MainTabs, 'Availability'>>();
  const requestedView = route.params?.registrationView;
  useEffect(() => {
    if (!requestedView) return;
    setView(requestedView);
    tabNavigation.setParams({ registrationView: undefined });
  }, [requestedView, tabNavigation]);
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const onOpen = (id: string) => navigation.navigate('WorkShift', { id });
  return (
    <>
      <Card style={styles.process}>
        {['workRegisterStep', 'workReviewStep', 'workAvailabilityStep'].map((step, index) => (
          <React.Fragment key={step}>
            {index > 0 && (
              <View style={styles.stepArrow}>
                <Feather name="chevron-right" size={16} color={colors.muted} accessible={false} />
              </View>
            )}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Txt style={styles.stepNumberText}>{index + 1}</Txt>
              </View>
              <Txt style={styles.stepText}>{t(step)}</Txt>
            </View>
          </React.Fragment>
        ))}
      </Card>
      <View style={styles.filters}>
        {registrationTabs.map(({ value, label }) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={t(label)}
            accessibilityState={{ selected: view === value }}
            onPress={() => setView(value)}
            style={({ pressed }) => [
              styles.filter,
              view === value && styles.activeFilter,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Txt style={[styles.filterLabel, view === value && styles.activeFilterLabel]}>
              {t(label)}
            </Txt>
            {value !== 'history' && overview.data && !overview.error && (
              <Txt style={styles.filterCount}>{overview.data[value]}</Txt>
            )}
          </Pressable>
        ))}
      </View>
      <ErrorBox error={overview.error} retry={overview.reload} />
      {view === 'open' ? (
        <OpenShifts onOpen={onOpen} refreshOverview={overview.reload} />
      ) : (
        <>
          {view === 'history' && <Txt muted>{t('workHistoryHint')}</Txt>}
          <MyRegistrations
            key={view}
            onOpen={onOpen}
            status={view === 'pending' ? 'PENDING' : view === 'approved' ? 'APPROVED' : undefined}
            refreshOverview={overview.reload}
          />
        </>
      )}
    </>
  );
}

export function RegisterShiftScreen() {
  const { t } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Screen>
      <PageHeader title={t('workChooseShift')} description={t('workChooseShiftHint')} />
      <OpenShifts onOpen={(id) => navigation.navigate('WorkShift', { id })} />
    </Screen>
  );
}
