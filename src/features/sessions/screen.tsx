// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Props } from '../../app/routes';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { optionalCoordinates } from '../../core/device';
import { formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Info,
  Pagination,
  RemoteState,
  Screen,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { ReportContent } from '../reports/screen';
import { SessionRepository } from './repository';
import { validateVitals } from './models';
import { SessionTaskCard } from './task-card';

export function SessionScreen({ route }: Props<'Session'>) {
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new SessionRepository(api), [api]);
  const id = route.params.id;
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(async () => ({ session: await repo.session(id) }), [repo, id]),
  );
  const notes = useRemote(useCallback(() => repo.notes(id, p), [repo, id, p]));
  useEffect(() => {
    if (notes.data && p > 0 && p >= notes.data.totalPages)
      setPage(Math.max(0, notes.data.totalPages - 1));
  }, [notes.data, p]);
  const write = useWrite();
  const [task, setTask] = useState('');
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [showVitals, setShowVitals] = useState(false);
  const [skip, setSkip] = useState('');
  const [reason, setReason] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reportState, setReportState] = useState({ locked: false, busy: false, dirty: false });
  const [confirming, setConfirming] = useState(false);
  const confirmation = useRef(false);
  const [operation, setOperation] = useState('');
  const dirty = !!(task || note || reason || Object.values(vitals).some(Boolean));
  useDirty(dirty || reportState.dirty, write.busy || confirming || reportState.busy);
  const data = remote.data;
  const editable = data?.session.status === 'IN_PROGRESS';
  const pending = data?.session.tasks.filter((item) => item.status === 'PENDING').length ?? 0;
  const sessionLocked =
    write.busy || write.uncertain || needsRefresh || remote.loading || !!remote.error || confirming;
  const locked = sessionLocked || reportState.locked;
  async function changeSkip(taskId: string) {
    if (locked || skip === taskId) return;
    if (reason && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return;
    setSkip(taskId);
    setReason('');
  }
  async function reconcile() {
    if (write.busy || confirming) return;
    const [session, freshNotes] = await Promise.all([remote.reload(), notes.reload()]);
    if (session && freshNotes) {
      write.reset();
      setNeedsRefresh(false);
    }
  }
  async function mutate(kind: string, action: () => Promise<unknown>, success?: () => void) {
    if (locked || !editable) return;
    setOperation(kind);
    try {
      await write.run(action, async () => {
        setNeedsRefresh(true);
        success?.();
        const [session, freshNotes] = await Promise.all([remote.reload(), notes.reload()]);
        if (session && freshNotes) setNeedsRefresh(false);
      });
    } finally {
      setOperation('');
    }
  }
  async function end() {
    if (locked || !editable || pending > 0 || confirmation.current) return;
    confirmation.current = true;
    setConfirming(true);
    let accepted = false;
    try {
      if (dirty && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
        return;
      accepted = await confirm(t('endQuestion'), t('endHint'), t('end'), t('cancel'));
    } finally {
      confirmation.current = false;
      setConfirming(false);
    }
    if (!accepted) return;
    await mutate(
      'end',
      async () => repo.end(id, await optionalCoordinates()),
      () => {
        setTask('');
        setNote('');
        setVitals({});
        setReason('');
        setSkip('');
      },
    );
  }
  const clock = (value: string) =>
    formatInstant(value, locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  return (
    <Screen>
      {data && <ErrorBox error={remote.error} retry={reconcile} />}
      <ErrorBox error={write.error} retry={reconcile} />
      <RemoteState
        loading={remote.loading && !data}
        error={data ? undefined : remote.error}
        retry={reconcile}
      >
        {data && (
          <>
            <View style={styles.header}>
              <Badge status={data.session.status} />
              {write.busy && <ActivityIndicator color={colors.primary} />}
            </View>
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                  <Feather
                    name="check-square"
                    size={21}
                    color={colors.primary}
                    accessible={false}
                  />
                  <Txt accessibilityRole="header" style={styles.title}>
                    {t('careTaskList')}
                  </Txt>
                </View>
                <Txt muted style={styles.meta}>
                  {t(editable ? 'careStartedAt' : 'careEndedAt').replace(
                    '{time}',
                    clock(editable ? data.session.checkInAt : data.session.checkOutAt),
                  )}
                </Txt>
              </View>
              {!data.session.tasks.length && <Txt muted>{t('noTasks')}</Txt>}
              {data.session.tasks.map((item) => (
                <SessionTaskCard
                  key={item.id}
                  task={item}
                  editable={editable}
                  locked={locked}
                  skipping={skip === item.id}
                  reason={reason}
                  onReason={setReason}
                  onDone={() => void mutate('task', () => repo.task(id, item.id, 'DONE'))}
                  onUndo={() => void mutate('task', () => repo.task(id, item.id, 'PENDING'))}
                  onSkip={() => void changeSkip(item.id)}
                  onCancelSkip={() => void changeSkip('')}
                  onSaveSkip={() =>
                    void mutate(
                      'task',
                      () => repo.task(id, item.id, 'SKIPPED', reason),
                      () => {
                        setSkip('');
                        setReason('');
                      },
                    )
                  }
                />
              ))}
              {editable && (
                <>
                  <View style={styles.addRow}>
                    <View style={styles.grow}>
                      <Field
                        label={t('customTask')}
                        value={task}
                        onChangeText={setTask}
                        maxLength={200}
                        editable={!locked}
                      />
                    </View>
                    <Button
                      label={t('careTaskAdd')}
                      kind="secondary"
                      disabled={locked || !task.trim()}
                      loading={operation === 'addTask'}
                      onPress={() =>
                        void mutate(
                          'addTask',
                          () => repo.addTask(id, task),
                          () => setTask(''),
                        )
                      }
                    />
                  </View>
                  <View style={styles.pending}>
                    <Txt accessibilityLiveRegion="polite">
                      {pending
                        ? t('carePendingTasks').replace('{count}', String(pending))
                        : t('careReadyToEnd')}
                    </Txt>
                  </View>
                  <Button
                    label={t('end')}
                    icon="log-out"
                    disabled={locked || pending > 0}
                    loading={operation === 'end'}
                    onPress={() => void end()}
                  />
                </>
              )}
            </Card>
            <Card style={styles.section}>
              <Txt accessibilityRole="header" style={styles.title}>
                {t('careSessionNotes')}
              </Txt>
              {notes.data && <ErrorBox error={notes.error} retry={reconcile} />}
              <RemoteState
                loading={notes.loading && !notes.data}
                error={notes.data ? undefined : notes.error}
                retry={reconcile}
              >
                {notes.data && (
                  <>
                    {notes.data.items.length ? (
                      notes.data.items.map((item) => (
                        <View key={item.id} style={styles.note}>
                          <Txt>{item.content}</Txt>
                          {item.vitals.map((value) => (
                            <Info key={value.label} label={t(value.label)} value={value.value} />
                          ))}
                          <Txt muted style={styles.meta}>
                            {formatInstant(item.createdAt, locale)}
                          </Txt>
                        </View>
                      ))
                    ) : (
                      <Txt muted>{t('noNotes')}</Txt>
                    )}
                    {notes.data.totalPages > 1 && (
                      <Pagination
                        {...notes.data}
                        onChange={(value) => {
                          if (!locked) setPage(value);
                        }}
                      />
                    )}
                  </>
                )}
              </RemoteState>
              {editable && (
                <>
                  <Field
                    label={t('careNewNote')}
                    value={note}
                    onChangeText={setNote}
                    maxLength={2000}
                    multiline
                    editable={!locked}
                  />
                  <Button
                    label={t(showVitals ? 'careHideVitals' : 'careShowVitals')}
                    icon={showVitals ? 'chevron-up' : 'activity'}
                    kind="secondary"
                    disabled={locked}
                    onPress={() => setShowVitals(!showVitals)}
                  />
                  {showVitals && (
                    <View style={styles.vitals}>
                      {[
                        'systolic',
                        'diastolic',
                        'heartRate',
                        'temperature',
                        'spo2',
                        'bloodGlucose',
                      ].map((key) => (
                        <View key={key} style={styles.vitalField}>
                          <Field
                            label={t(key)}
                            value={vitals[key] ?? ''}
                            onChangeText={(value) =>
                              setVitals((current) => ({ ...current, [key]: value }))
                            }
                            keyboardType="decimal-pad"
                            editable={!locked}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                  <Button
                    label={t('careAddNote')}
                    disabled={locked || notes.loading || !!notes.error || !note.trim()}
                    loading={operation === 'note'}
                    onPress={() =>
                      void mutate(
                        'note',
                        () => repo.addNote(id, note, validateVitals(vitals)),
                        () => {
                          setNote('');
                          setVitals({});
                          setPage(0);
                        },
                      )
                    }
                  />
                </>
              )}
            </Card>
            <ReportContent
              bookingId={data.session.bookingId}
              sessionId={id}
              sessionStatus={data.session.status}
              externalLocked={sessionLocked}
              onStateChange={setReportState}
            />
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section: { padding: 16, gap: 16 },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 13, lineHeight: 20 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  grow: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  pending: { padding: 14, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  note: { padding: 14, borderRadius: 12, backgroundColor: colors.surfaceMuted, gap: 8 },
  vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vitalField: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
});
