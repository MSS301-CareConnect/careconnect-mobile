import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../core/api';
import { useReducedMotion } from '../../core/accessibility';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant, vietnamDay } from '../../core/time';
import { pickCalendarDate } from '../../core/date-picker';
import {
  Button,
  Card,
  Chips,
  ErrorBox,
  Field,
  IconButton,
  PageHeader,
  RemoteState,
  Row,
  Screen,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { AvailabilityRepository } from './repository';
import { TimeOff, TimeOffForm, TimeOffInput, timeOffInput, timeOffRange } from './time-off';

function initialForm(): TimeOffForm {
  return {
    startDate: vietnamDay(),
    endDate: vietnamDay(),
    allDay: true,
    startTime: '',
    endTime: '',
    reason: '',
  };
}
export function TimeOffScreen({
  header,
  onInteractionLockChange,
}: {
  header?: React.ReactNode;
  onInteractionLockChange?: (locked: boolean) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new AvailabilityRepository(api), [api]);
  const remote = useRemote(
    useCallback(async () => {
      const caregiverId = await repo.caregiverId();
      return { caregiverId, items: await repo.timeOffs(caregiverId) };
    }, [repo]),
  );
  const write = useWrite();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<TimeOff>();
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [exists, setExists] = useState(false);
  const [notice, setNotice] = useState('');
  const [choosingDate, setChoosingDate] = useState(false);
  const [dateError, setDateError] = useState('');
  const pickerOpen = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [confirmed, setConfirmed] = useState<TimeOff[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const closing = useRef(false);
  const attempted = useRef<TimeOffInput | undefined>(undefined);
  useEffect(() => {
    // Mutation results bridge a failed read; a successful full read becomes authoritative again.
    setConfirmed((current) => (current.length ? [] : current));
    setRemoved((current) => (current.length ? [] : current));
  }, [remote.data]);
  const modal = adding || !!deleting;
  useEffect(() => {
    onInteractionLockChange?.(modal || write.busy || write.uncertain);
  }, [modal, write.busy, write.uncertain, onInteractionLockChange]);
  useDirty(adding && touched, write.busy || choosingDate);
  let input: TimeOffInput | undefined;
  try {
    input = timeOffInput(form);
  } catch {
    /* Inline validation accompanies the form. */
  }
  const locked =
    write.busy || choosingDate || write.uncertain || remote.loading || !!remote.error || exists;
  const formDisabled = write.busy || choosingDate || exists;
  const items = [
    ...(remote.data?.items ?? []),
    ...confirmed.filter((item) => !remote.data?.items.some((server) => server.id === item.id)),
  ].filter((item) => !removed.includes(item.id) && Date.parse(item.endAt) > Date.now());
  function update(change: Partial<TimeOffForm>) {
    setForm((current) => ({ ...current, ...change }));
    setTouched(true);
    setExists(false);
    if (change.startDate !== undefined || change.endDate !== undefined) setDateError('');
  }
  async function chooseDate(key: 'startDate' | 'endDate') {
    if (!adding || write.busy || exists || pickerOpen.current) return;
    pickerOpen.current = true;
    setChoosingDate(true);
    setDateError('');
    Keyboard.dismiss();
    try {
      const selected = await pickCalendarDate(
        form[key],
        t(key === 'startDate' ? 'timeOffPickStartDate' : 'timeOffPickEndDate'),
        t('confirm'),
        t('cancel'),
      );
      if (mounted.current && selected !== undefined && selected !== form[key])
        update({ [key]: selected });
    } catch {
      if (mounted.current) setDateError('timeOffCalendarUnavailable');
    } finally {
      pickerOpen.current = false;
      if (mounted.current) setChoosingDate(false);
    }
  }
  async function close() {
    if (write.busy || pickerOpen.current || closing.current) return;
    closing.current = true;
    try {
      if (
        adding &&
        touched &&
        !exists &&
        !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel')))
      )
        return;
      setAdding(false);
      setDeleting(undefined);
      setTouched(false);
      setExists(false);
    } finally {
      closing.current = false;
    }
  }
  async function reconcile() {
    if (write.busy) return;
    const fresh = await remote.reload();
    if (!fresh) return;
    const checked = attempted.current ?? input;
    const matching =
      checked &&
      fresh.items.some(
        (item) =>
          Date.parse(item.startAt) === Date.parse(checked.startAt) &&
          Date.parse(item.endAt) === Date.parse(checked.endAt),
      );
    if (adding && matching) {
      setExists(true);
      write.reset();
      return;
    }
    if (deleting && !fresh.items.some((item) => item.id === deleting.id)) {
      setDeleting(undefined);
      setNotice('timeOffDeleted');
    }
    write.reset();
    attempted.current = undefined;
  }
  function save() {
    setShowValidation(true);
    if (locked || pickerOpen.current || !input || !remote.data) return;
    const caregiverId = remote.data.caregiverId;
    attempted.current = input;
    void write.run(
      () => repo.createTimeOff(caregiverId, input),
      async (result) => {
        setConfirmed((current) => [...current, result]);
        setAdding(false);
        setTouched(false);
        setNotice('timeOffSaved');
        attempted.current = undefined;
        await remote.reload();
      },
    );
  }
  function range(item: TimeOff) {
    const dates = timeOffRange(item);
    if (dates.allDay)
      return `${dates.startDay}${dates.startDay !== dates.endDay ? ` – ${dates.endDay}` : ''} · ${t('timeOffAllDay')}`;
    return `${formatInstant(item.startAt, locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} – ${formatInstant(item.endAt, locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`;
  }
  const errorKey =
    write.error instanceof ApiError
      ? (
          {
            4406: 'timeOffOverlap',
            4407: 'timeOffInvalid',
            4408: 'timeOffBooked',
            4410: 'timeOffInvalid',
            4411: 'timeOffInvalid',
          } as Record<number, string>
        )[write.error.code]
      : undefined;
  return (
    <>
      <View
        style={styles.fill}
        pointerEvents={modal ? 'none' : 'auto'}
        importantForAccessibility={modal ? 'no-hide-descendants' : 'auto'}
      >
        <Screen>
          {header}
          {header ? (
            <Row>
              <View style={styles.fill}>
                <Txt muted>{t('timeOffHint')}</Txt>
              </View>
              <IconButton
                label={t('refresh')}
                icon="refresh-cw"
                disabled={remote.loading || write.busy}
                onPress={() => void reconcile()}
              />
            </Row>
          ) : (
            <PageHeader
              title={t('timeOffTitle')}
              description={t('timeOffHint')}
              action={
                <IconButton
                  label={t('refresh')}
                  icon="refresh-cw"
                  disabled={remote.loading || write.busy}
                  onPress={() => void reconcile()}
                />
              }
            />
          )}
          <Button
            label={t('timeOffAdd')}
            icon="plus"
            disabled={!remote.data || remote.loading || write.busy}
            onPress={() => {
              setForm(initialForm());
              setShowValidation(false);
              setExists(false);
              setTouched(false);
              setAdding(true);
              setNotice('');
              setDateError('');
            }}
          />
          {notice !== '' && <Txt>{t(notice)}</Txt>}
          {!modal && <ErrorBox error={write.error} retry={reconcile} />}
          {remote.data && <ErrorBox error={remote.error} retry={reconcile} />}
          <RemoteState
            loading={remote.loading && !remote.data}
            error={remote.data ? undefined : remote.error}
            retry={reconcile}
          >
            {items.length === 0 && remote.data && (
              <Card>
                <Txt muted>{t('timeOffEmpty')}</Txt>
              </Card>
            )}
            {items.map((item) => (
              <Card key={item.id}>
                <Txt style={styles.range}>{range(item)}</Txt>
                {!!item.reason && <Txt>{item.reason}</Txt>}
                <Button
                  label={t('timeOffDelete')}
                  kind="danger"
                  disabled={write.busy || write.uncertain || remote.loading || !!remote.error}
                  onPress={() => setDeleting(item)}
                />
              </Card>
            ))}
          </RemoteState>
        </Screen>
      </View>
      <Modal
        visible={modal}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => void close()}
      >
        <SafeAreaView style={styles.backdrop} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={styles.fill}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View accessibilityViewIsModal>
                <Card style={styles.modalCard}>
                  <Row>
                    <View style={styles.fill}>
                      <Txt style={styles.modalTitle}>
                        {t(adding ? 'timeOffAdd' : 'timeOffDeleteQuestion')}
                      </Txt>
                    </View>
                    <IconButton
                      label={t('close')}
                      icon="x"
                      disabled={write.busy || choosingDate}
                      onPress={() => void close()}
                    />
                  </Row>
                  {adding ? (
                    <>
                      <Txt muted>{t('timeOffLimit')}</Txt>
                      <Chips
                        values={[
                          { value: 'day', label: t('timeOffAllDay') },
                          { value: 'time', label: t('timeOffTimed') },
                        ]}
                        value={form.allDay ? 'day' : 'time'}
                        onChange={(value) => {
                          if (!formDisabled) update({ allDay: value === 'day' });
                        }}
                      />
                      <Field
                        label={t('workFromDate')}
                        value={form.startDate}
                        onChangeText={(startDate) => update({ startDate })}
                        editable={!formDisabled}
                        placeholder={t('workDatePlaceholder')}
                        hint={t('timeOffCalendarHint')}
                        maxLength={10}
                        autoCorrect={false}
                        trailing={
                          <IconButton
                            icon="calendar"
                            label={t('timeOffPickStartDate')}
                            disabled={formDisabled}
                            onPress={() => {
                              chooseDate('startDate');
                            }}
                          />
                        }
                      />
                      <Field
                        label={t('workToDate')}
                        value={form.endDate}
                        onChangeText={(endDate) => update({ endDate })}
                        editable={!formDisabled}
                        placeholder={t('workDatePlaceholder')}
                        hint={t('timeOffCalendarHint')}
                        maxLength={10}
                        autoCorrect={false}
                        trailing={
                          <IconButton
                            icon="calendar"
                            label={t('timeOffPickEndDate')}
                            disabled={formDisabled}
                            onPress={() => {
                              chooseDate('endDate');
                            }}
                          />
                        }
                      />
                      {!!dateError && (
                        <Txt
                          accessibilityRole="alert"
                          accessibilityLiveRegion="polite"
                          style={styles.error}
                        >
                          {t(dateError)}
                        </Txt>
                      )}
                      {!form.allDay && (
                        <>
                          <Field
                            label={t('timeOffStartTime')}
                            value={form.startTime}
                            onChangeText={(startTime) => update({ startTime })}
                            editable={!formDisabled}
                            placeholder={t('workTimePlaceholder')}
                          />
                          <Field
                            label={t('timeOffEndTime')}
                            value={form.endTime}
                            onChangeText={(endTime) => update({ endTime })}
                            editable={!formDisabled}
                            placeholder={t('workTimePlaceholder')}
                          />
                        </>
                      )}
                      <Field
                        label={t('timeOffReason')}
                        value={form.reason}
                        onChangeText={(reason) => update({ reason })}
                        editable={!formDisabled}
                        multiline
                        maxLength={500}
                      />
                      {showValidation && !input && (
                        <Txt style={styles.error}>{t('timeOffInvalid')}</Txt>
                      )}
                      {exists && <Txt>{t('timeOffExists')}</Txt>}
                    </>
                  ) : (
                    deleting && (
                      <>
                        <Txt style={styles.range}>{range(deleting)}</Txt>
                        <Txt>{t('timeOffDeleteHint')}</Txt>
                      </>
                    )
                  )}
                  {errorKey && <Txt style={styles.error}>{t(errorKey)}</Txt>}
                  <ErrorBox error={write.error} retry={reconcile} />
                  <ErrorBox error={remote.error} retry={reconcile} />
                  {write.uncertain && adding && <Txt muted>{t('timeOffReconcile')}</Txt>}
                  {adding ? (
                    <Button
                      label={t('save')}
                      loading={write.busy}
                      disabled={locked}
                      onPress={save}
                    />
                  ) : (
                    <Button
                      label={t('timeOffDeleteConfirm')}
                      kind="danger"
                      loading={write.busy}
                      disabled={locked || !deleting || !remote.data}
                      onPress={() => {
                        if (!deleting || !remote.data || locked) return;
                        const target = deleting;
                        const caregiverId = remote.data.caregiverId;
                        void write.run(
                          () => repo.deleteTimeOff(caregiverId, target.id),
                          async () => {
                            setRemoved((current) => [...current, target.id]);
                            setDeleting(undefined);
                            setNotice('timeOffDeleted');
                            await remote.reload();
                          },
                        );
                      }}
                    />
                  )}
                  <Button
                    label={t('close')}
                    kind="secondary"
                    disabled={write.busy || choosingDate}
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
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 16 },
  modalTitle: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  range: { fontWeight: '700', color: colors.primary },
  error: { color: colors.danger },
});
