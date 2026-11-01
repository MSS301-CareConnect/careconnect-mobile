import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
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
  Row,
  Screen,
  Section,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { SessionRepository } from './repository';
import { validateVitals } from './models';
export function SessionScreen({ route, navigation }: Props<'Session'>) {
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new SessionRepository(api), [api]);
  const id = route.params.id;
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(
      async () => ({ session: await repo.session(id), notes: await repo.notes(id, p) }),
      [repo, id, p],
    ),
  );
  const write = useWrite();
  const [task, setTask] = useState('');
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState('');
  const [reason, setReason] = useState('');
  const dirty = !!(task || note || reason || Object.values(vitals).some(Boolean));
  useDirty(dirty, write.busy);
  async function reconcile() {
    const result = await remote.reload();
    if (result) write.reset();
  }
  async function end() {
    if (dirty && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return;
    if (!(await confirm(t('endQuestion'), t('endHint'), t('end'), t('cancel')))) return;
    await write.run(
      async () => repo.end(id, await optionalCoordinates()),
      async () => {
        setTask('');
        setNote('');
        setVitals({});
        setReason('');
        setSkip('');
        await remote.reload();
      },
    );
  }
  const data = remote.data;
  const editable = data?.session.status === 'IN_PROGRESS';
  const locked = write.busy || write.uncertain;
  return (
    <Screen>
      <RemoteState {...remote} retry={remote.reload}>
        {data && (
          <>
            <View style={{ gap: 10 }}>
              <Title>{t(editable ? 'activeCare' : 'ended')}</Title>
              <Badge status={data.session.status} />
              <Txt muted>
                {formatInstant(data.session.checkInAt, locale)}
                {data.session.checkOutAt
                  ? ' – ' + formatInstant(data.session.checkOutAt, locale)
                  : ''}
              </Txt>
            </View>
            <Section title={t('checklist')} icon="check-square">
              <Row>
                <Txt style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>
                  {data.session.done}/{data.session.tasks.length}
                </Txt>
                <Txt muted>{t('progress')}</Txt>
              </Row>
              <View
                style={{
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.pale,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 7,
                    backgroundColor: colors.primary,
                    width: `${data.session.tasks.length ? (data.session.done / data.session.tasks.length) * 100 : 0}%`,
                  }}
                />
              </View>
              {!data.session.tasks.length && <Txt muted>{t('noTasks')}</Txt>}
              {data.session.tasks.map((item) => (
                <Card key={item.id} style={{ padding: 14, backgroundColor: '#FAFCF8' }}>
                  <Txt style={{ fontWeight: '700' }}>{item.title}</Txt>
                  <Badge status={item.status} />
                  {item.skipReason && <Info label={t('skipReason')} value={item.skipReason} />}
                  {editable && (
                    <>
                      <Row>
                        {item.status !== 'DONE' && (
                          <Button
                            kind="secondary"
                            label={t('done')}
                            disabled={locked}
                            onPress={() =>
                              void write.run(
                                () => repo.task(id, item.id, 'DONE'),
                                async () => {
                                  await remote.reload();
                                },
                              )
                            }
                          />
                        )}
                        {item.status !== 'PENDING' && (
                          <Button
                            kind="secondary"
                            label={t('undo')}
                            disabled={locked}
                            onPress={() =>
                              void write.run(
                                () => repo.task(id, item.id, 'PENDING'),
                                async () => {
                                  await remote.reload();
                                },
                              )
                            }
                          />
                        )}
                        {item.status !== 'SKIPPED' && (
                          <Button
                            kind="secondary"
                            label={t('skip')}
                            disabled={locked}
                            onPress={() => {
                              setSkip(item.id);
                              setReason('');
                            }}
                          />
                        )}
                      </Row>
                      {skip === item.id && (
                        <>
                          <Field
                            label={t('skipReason')}
                            value={reason}
                            onChangeText={setReason}
                            maxLength={500}
                          />
                          <Button
                            label={t('save')}
                            disabled={locked || !reason.trim()}
                            onPress={() =>
                              void write.run(
                                () => repo.task(id, item.id, 'SKIPPED', reason),
                                async () => {
                                  setSkip('');
                                  setReason('');
                                  await remote.reload();
                                },
                              )
                            }
                          />
                        </>
                      )}
                    </>
                  )}
                </Card>
              ))}
            </Section>
            {editable && (
              <Section title={t('customTask')} icon="plus-circle">
                <Field
                  label={t('customTask')}
                  value={task}
                  onChangeText={setTask}
                  maxLength={200}
                  editable={!write.busy}
                />
                <Button
                  label={t('addTask')}
                  disabled={locked || !task.trim()}
                  loading={write.busy}
                  onPress={() =>
                    void write.run(
                      () => repo.addTask(id, task),
                      async () => {
                        setTask('');
                        await remote.reload();
                      },
                    )
                  }
                />
              </Section>
            )}
            <Section title={t('notes')} icon="file-text">
              {data.notes.items.length ? (
                data.notes.items.map((item) => (
                  <Card key={item.id} style={{ padding: 12, backgroundColor: '#FAFCF8' }}>
                    <Txt muted style={{ fontSize: 12 }}>
                      {formatInstant(item.createdAt, locale)}
                    </Txt>
                    <Txt>{item.content}</Txt>
                    {item.vitals.map((v) => (
                      <Info key={v.label} label={t(v.label)} value={v.value} />
                    ))}
                  </Card>
                ))
              ) : (
                <Txt muted>{t('noNotes')}</Txt>
              )}
              <Pagination {...data.notes} onChange={setPage} />
            </Section>
            {editable && (
              <Section title={t('addNote')} icon="edit-3">
                <Field
                  label={t('noteContent')}
                  value={note}
                  onChangeText={setNote}
                  maxLength={2000}
                  multiline
                  editable={!write.busy}
                />
                <Txt muted>{t('vitals')}</Txt>
                {['systolic', 'diastolic', 'heartRate', 'temperature', 'spo2', 'bloodGlucose'].map(
                  (key) => (
                    <Field
                      key={key}
                      label={t(key)}
                      value={vitals[key] ?? ''}
                      onChangeText={(value) =>
                        setVitals((current) => ({ ...current, [key]: value }))
                      }
                      keyboardType="decimal-pad"
                      editable={!write.busy}
                    />
                  ),
                )}
                <Button
                  label={t('addNote')}
                  disabled={locked || !note.trim()}
                  loading={write.busy}
                  onPress={() =>
                    void write.run(
                      () => repo.addNote(id, note, validateVitals(vitals)),
                      async () => {
                        setNote('');
                        setVitals({});
                        setPage(0);
                        await remote.reload();
                      },
                    )
                  }
                />
              </Section>
            )}
            <ErrorBox error={write.error} retry={reconcile} />
            {editable && (
              <Button
                label={t('end')}
                loading={write.busy}
                disabled={write.uncertain}
                onPress={() => void end()}
              />
            )}
            <Button
              kind="secondary"
              label={t('report')}
              disabled={write.busy}
              onPress={() =>
                navigation.navigate('Report', { bookingId: data.session.bookingId, sessionId: id })
              }
            />
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
