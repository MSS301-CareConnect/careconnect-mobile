import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Pagination,
  RemoteState,
  Row,
  Screen,
  Title,
  Txt,
  colors,
} from '../../core/ui';
import { WorkShiftRepository } from './repository';
import { registrationBlockReason, WorkShift } from './models';
import { RegistrationStatus, ShiftSummary } from './card';

const styles = StyleSheet.create({
  card: { gap: 9, padding: 16, borderRadius: 18, elevation: 1 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detailsText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  detailsLink: { minHeight: 44, paddingLeft: 8 },
  fill: { flex: 1 },
});
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
  shift?: WorkShift;
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
function OpenShifts({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const remote = useRemote(useCallback(() => repo.board(), [repo]));
  useBoardPolling(remote.reload, remote.loading);
  const board = remote.data;
  const total = board?.items.length ?? 0;
  const totalPages = Math.ceil(total / 20);
  const currentPage = Math.min(p, Math.max(0, totalPages - 1));
  const items = remote.data?.items.slice(currentPage * 20, currentPage * 20 + 20) ?? [];
  return (
    <>
      <View style={{ gap: 6 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Title>{t('workShiftTab')}</Title>
          </View>
          <IconButton
            label={t('refreshWorkShifts')}
            icon="refresh-cw"
            disabled={remote.loading}
            onPress={() => void remote.reload()}
          />
        </Row>
        {remote.data?.centerName ? (
          <Txt style={{ color: colors.primary, fontWeight: '700' }}>{remote.data.centerName}</Txt>
        ) : null}
        <Txt muted style={{ fontSize: 13, lineHeight: 20 }}>
          {t('workShiftsIntro')}
        </Txt>
      </View>
      <Row>
        <Txt style={{ fontSize: 19, fontWeight: '800' }}>{t('workShiftsOpen')}</Txt>
        <Badge status={String(total)} />
      </Row>
      <RemoteState {...remote} loading={remote.loading && !remote.data} retry={remote.reload}>
        {board && (
          <>
            {!board.eligible && (
              <Card>
                <Txt>{t('workShiftEligibility')}</Txt>
              </Card>
            )}
            {items.length === 0 && (
              <Card>
                <Txt muted>{t('workShiftsEmpty')}</Txt>
              </Card>
            )}
            {items.map(({ shift, registration }) => {
              const blocked = registrationBlockReason(
                shift,
                registration,
                board.eligible,
                board.loadedAt,
              );
              const content = (
                <>
                  <ShiftSummary
                    shift={shift}
                    headerAction={
                      <DetailsHint onPress={registration ? undefined : () => onOpen(shift.id)} />
                    }
                    action={
                      registration ? (
                        <Badge status="workShiftAlreadyRegisteredLabel" />
                      ) : !blocked ? (
                        <Button
                          label={t('workShiftRegisterAction')}
                          onPress={() => onOpen(shift.id)}
                        />
                      ) : null
                    }
                  />
                  {shift.note !== '' && (
                    <Txt muted numberOfLines={2}>
                      {shift.note}
                    </Txt>
                  )}
                  {!registration && blocked && <Txt muted>{t(blocked)}</Txt>}
                </>
              );
              return registration ? (
                <NavigableShiftCard
                  key={shift.id}
                  shift={shift}
                  status={t('workShiftAlreadyRegisteredLabel')}
                  onOpen={() => onOpen(shift.id)}
                >
                  {content}
                </NavigableShiftCard>
              ) : (
                <Card key={shift.id} style={styles.card}>
                  {content}
                </Card>
              );
            })}
            {totalPages > 1 && (
              <Pagination
                page={currentPage}
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
function MyRegistrations({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const remote = useRemote(useCallback(() => repo.mine(p), [repo, p]));
  useBoardPolling(remote.reload, remote.loading);
  return (
    <>
      <View style={{ height: 1, backgroundColor: colors.line, marginTop: 6 }} />
      <Row>
        <Txt style={{ flex: 1, fontSize: 19, fontWeight: '800' }}>
          {t('workShiftRegistrations')}
        </Txt>
        <IconButton
          label={t('refreshRegistrations')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={() => void remote.reload()}
        />
      </Row>
      <RemoteState {...remote} loading={remote.loading && !remote.data} retry={remote.reload}>
        {remote.data && (
          <>
            {remote.data.items.length === 0 && (
              <Card>
                <Txt muted>{t('workShiftRegistrationsEmpty')}</Txt>
              </Card>
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
export function WorkShiftsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const onOpen = (id: string) => navigation.navigate('WorkShift', { id });
  return (
    <Screen>
      <OpenShifts onOpen={onOpen} />
      <MyRegistrations onOpen={onOpen} />
    </Screen>
  );
}
