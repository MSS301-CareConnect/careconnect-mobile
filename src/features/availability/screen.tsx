import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Routes } from '../../app/routes';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { ApiError } from '../../core/api';
import { useReducedMotion } from '../../core/accessibility';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import { useVietnamDay } from '../../core/use-vietnam-day';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Info,
  IconButton,
  Pagination,
  RemoteState,
  Row,
  Screen,
  PageHeader,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { AvailabilityRepository } from './repository';
import { canCancelSchedule, ProviderSchedule } from './models';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new AvailabilityRepository(api), [api]);
}
function CancelScheduleButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
}) {
  const foreground = primary ? colors.white : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: 12,
        backgroundColor: primary ? colors.danger : colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Feather name="x-circle" size={17} color={foreground} />
      )}
      <Txt style={[styles.buttonText, { color: foreground }]}>{label}</Txt>
    </Pressable>
  );
}
function ScheduleWriteError({ error }: { error: unknown }) {
  const { t } = useApp();
  const key =
    error instanceof ApiError
      ? error.code === 4415
        ? 'cancelScheduleBooked'
        : error.code === 4404
          ? 'conflict'
          : error.code === 4402
            ? 'cancelScheduleStateChanged'
            : error.code === 4403
              ? 'cancelScheduleReasonRequired'
              : undefined
      : undefined;
  return key ? <Txt style={styles.error}>{t(key)}</Txt> : <ErrorBox error={error} />;
}
export function ProviderScheduleScreen() {
  const reducedMotion = useReducedMotion();
  const { t, locale } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const route = useRoute<RouteProp<Routes, 'ProviderSchedule'>>();
  const targetId = route.params?.scheduleId;
  const cancelOnOpen = route.params?.cancel === true;
  const openedTarget = useRef('');
  const day = useVietnamDay();
  const load = useCallback(async () => {
    if (!targetId) return repo.schedules(p);
    const schedule = await repo.findSchedule(targetId);
    return {
      items: schedule ? [schedule] : [],
      page: 0,
      totalPages: 1,
      totalElements: schedule ? 1 : 0,
    };
  }, [repo, p, targetId]);
  const remote = useRemote(load);
  const reload = remote.reload;
  const write = useWrite();
  const [selected, setSelected] = useState<ProviderSchedule>();
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, ProviderSchedule>>({});
  const lastAttempt = useRef<string>(undefined);
  const closing = useRef(false);
  const previousDay = useRef(day);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const target = remote.data?.items.find((item) => item.id === targetId);
    if (target && cancelOnOpen && openedTarget.current !== targetId) {
      openedTarget.current = target.id;
      setSelected(target);
    }
  }, [targetId, cancelOnOpen, remote.data]);
  useDirty(!!selected && reason.length > 0, write.busy);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousDay.current !== day) {
      previousDay.current = day;
      void reload();
    }
  }, [day, reload]);
  useEffect(() => {
    // Keep the parsed mutation result visible until a matching or newer GET arrives.
    setConfirmed((current) => {
      const next = { ...current };
      let changed = false;
      remote.data?.items.forEach((item) => {
        const previous = next[item.id];
        if (
          previous &&
          (item.version > previous.version ||
            (item.version === previous.version && item.status === previous.status))
        ) {
          delete next[item.id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [remote.data]);
  function latest(item: ProviderSchedule) {
    const result = confirmed[item.id];
    return result && result.version >= item.version ? result : item;
  }
  const current = remote.data?.items.find((item) => item.id === selected?.id);
  const schedule = current ? latest(current) : undefined;
  const locked = write.busy || write.uncertain || remote.loading || !!remote.error;
  const valid =
    !!schedule && canCancelSchedule(schedule, now) && !!reason.trim() && reason.length <= 500;
  async function reconcile() {
    if (write.busy) return;
    const fresh = await remote.reload();
    if (
      fresh &&
      (!lastAttempt.current || fresh.items.some((item) => item.id === lastAttempt.current))
    )
      write.reset();
  }
  async function close() {
    if (write.busy || closing.current) return;
    closing.current = true;
    try {
      if (
        reason.length > 0 &&
        !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel')))
      )
        return;
      setSelected(undefined);
      setReason('');
    } finally {
      closing.current = false;
    }
  }
  function cancelSelected() {
    if (locked || !valid || !schedule) return;
    if (!canCancelSchedule(schedule)) {
      setNow(Date.now());
      return;
    }
    lastAttempt.current = schedule.id;
    void write.run(
      () => repo.cancelSchedule(schedule, reason),
      async (result) => {
        setConfirmed((items) => ({ ...items, [result.id]: result }));
        setSelected(undefined);
        setReason('');
        setSaved(true);
        await remote.reload();
      },
    );
  }
  function dateLabel(item: ProviderSchedule) {
    return formatInstant(`${item.date}T00:00:00+07:00`, locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }
  return (
    <>
      <View
        style={styles.fill}
        pointerEvents={selected ? 'none' : 'auto'}
        importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
      >
        <Screen>
          <PageHeader
            title={t('providerSchedule')}
            action={
              <IconButton
                label={t('refresh')}
                icon="refresh-cw"
                disabled={remote.loading || write.busy}
                onPress={() => void reconcile()}
              />
            }
          />
          <Txt muted>{t('providerHint')}</Txt>
          {targetId && !remote.loading && remote.data?.items.length === 0 && (
            <Txt>{t('cancelScheduleMissing')}</Txt>
          )}
          {saved && <Txt>{t('cancelScheduleSuccess')}</Txt>}
          {!selected && <ScheduleWriteError error={write.error} />}
          {remote.data && <ErrorBox error={remote.error} />}
          {remote.loading && remote.data && <Txt muted>{t('loading')}</Txt>}
          <RemoteState
            loading={remote.loading && !remote.data}
            error={remote.data ? undefined : remote.error}
            empty={remote.data?.items.length === 0}
            retry={reconcile}
          >
            {remote.data?.items.map((loaded) => {
              const item = latest(loaded);
              return (
                <Card key={item.id} style={styles.slotCard}>
                  <Txt style={styles.date}>{dateLabel(item)}</Txt>
                  <Row>
                    <Feather name="clock" size={20} color={colors.primary} />
                    <Txt style={styles.time}>
                      {item.start.slice(0, 5)}–{item.end.slice(0, 5)}
                    </Txt>
                  </Row>
                  <Row>
                    <View style={styles.fill}>
                      <Badge
                        status={item.status === 'SCHEDULED' ? 'provider_SCHEDULED' : item.status}
                      />
                    </View>
                    {canCancelSchedule(item, now) && (
                      <CancelScheduleButton
                        label={t('cancelSchedule')}
                        disabled={write.busy || remote.loading || !!remote.error}
                        onPress={() => {
                          if (!canCancelSchedule(item)) {
                            setNow(Date.now());
                            return;
                          }
                          setSaved(false);
                          setReason('');
                          setSelected(item);
                        }}
                      />
                    )}
                  </Row>
                  {!!item.note && <Txt muted>{item.note}</Txt>}
                  {item.status === 'CANCELLED' && !!item.cancellationReason && (
                    <Info label={t('cancelScheduleReason')} value={item.cancellationReason} />
                  )}
                </Card>
              );
            })}
          </RemoteState>
          {remote.data && remote.data.totalPages > 1 && (
            <Pagination
              {...remote.data}
              onChange={(page) => {
                if (!selected && !write.busy) setPage(page);
              }}
            />
          )}
        </Screen>
      </View>
      <Modal
        visible={!!selected}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => void close()}
      >
        <SafeAreaView style={styles.modalBackdrop} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={styles.fill}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View accessibilityViewIsModal>
                <Card style={styles.modalCard}>
                  <Row>
                    <View style={styles.fill}>
                      <Txt style={styles.modalTitle}>{t('cancelSchedule')}</Txt>
                    </View>
                    <IconButton
                      label={t('close')}
                      icon="x"
                      disabled={write.busy}
                      onPress={() => void close()}
                    />
                  </Row>
                  {selected && (
                    <Txt style={styles.bold}>
                      {dateLabel(schedule ?? selected)} · {(schedule ?? selected).start.slice(0, 5)}
                      –{(schedule ?? selected).end.slice(0, 5)}
                    </Txt>
                  )}
                  <Txt muted>{t('cancelScheduleHint')}</Txt>
                  {!remote.loading && !schedule && (
                    <Txt style={styles.error}>{t('cancelScheduleMissing')}</Txt>
                  )}
                  {schedule?.status === 'CANCELLED' && (
                    <>
                      <Badge status="CANCELLED" />
                      <Txt>{t('cancelScheduleAlreadyCancelled')}</Txt>
                      <Info label={t('cancelScheduleReason')} value={schedule.cancellationReason} />
                    </>
                  )}
                  {schedule &&
                    schedule.status !== 'CANCELLED' &&
                    !canCancelSchedule(schedule, now) && (
                      <Txt>{t('cancelScheduleStateChanged')}</Txt>
                    )}
                  <Field
                    label={t('cancelScheduleReason')}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={500}
                    editable={!write.busy && schedule?.status !== 'CANCELLED'}
                  />
                  <Txt muted>{t('cancelScheduleReasonLimit')}</Txt>
                  <ScheduleWriteError error={write.error} />
                  <ErrorBox error={remote.error} />
                  {(!!write.error || !!remote.error || !schedule) && (
                    <Button
                      label={t('refresh')}
                      kind="secondary"
                      loading={remote.loading}
                      disabled={write.busy}
                      onPress={() => void reconcile()}
                    />
                  )}
                  {schedule?.status !== 'CANCELLED' && (
                    <CancelScheduleButton
                      label={t('cancelScheduleConfirm')}
                      primary
                      busy={write.busy}
                      disabled={locked || !valid}
                      onPress={cancelSelected}
                    />
                  )}
                  <Button
                    label={t('cancelScheduleKeep')}
                    kind="secondary"
                    disabled={write.busy}
                    onPress={() => void close()}
                  />
                </Card>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: colors.scrim },
  fill: { flex: 1 },
  slotCard: { gap: 8, padding: 16 },
  date: { fontWeight: '700', color: colors.primary },
  time: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  bold: { fontWeight: '700' },
  error: { color: colors.danger },
  buttonText: { fontWeight: '700', flexShrink: 1 },
  modalTitle: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 },
});
export { TimeOffScreen } from './time-off-screen';
