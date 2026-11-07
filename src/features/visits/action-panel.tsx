import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Props } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { optionalCoordinates } from '../../core/device';
import { useDirty, useWrite } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Button,
  ErrorBox,
  Field,
  IconButton,
  Info,
  Row,
  Screen,
  Section,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { SessionRepository } from '../sessions/repository';
import {
  canAcknowledge,
  careStartStep,
  canReportNoShow,
  visitErrorKey,
  visitWindow,
  waitingForNoShow,
} from './actions';
import { Visit } from './models';
import { VisitRepository } from './repository';

export function VisitActionPanel({
  visit,
  repo,
  reload,
  navigation,
  unavailable,
  readError,
}: {
  visit: Visit;
  repo: VisitRepository;
  reload: () => Promise<Visit | undefined>;
  navigation: Props<'Visit'>['navigation'];
  unavailable: boolean;
  readError?: unknown;
}) {
  const { api, t, locale } = useApp();
  const reducedMotion = useReducedMotion();
  const sessions = useMemo(() => new SessionRepository(api), [api]);
  const write = useWrite();
  const [now, setNow] = useState(Date.now);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [checkpoint, setCheckpoint] = useState<Visit>();
  const [reading, setReading] = useState(false);
  useDirty(reporting && !!note, write.busy);
  useEffect(() => {
    setCheckpoint(undefined);
  }, [visit]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const current = checkpoint ?? visit;
  const window = visitWindow(current);
  const startStep = careStartStep(current, now);
  const waiting = waitingForNoShow(current);
  const editable =
    ['SCHEDULED', 'ACKNOWLEDGED'].includes(current.status) && !current.sessionId && !waiting;
  const invalidNote = note.trim().length < 10 || note.trim().length > 1000;
  async function reconcile() {
    if (reading || write.busy) return;
    setReading(true);
    try {
      const fresh = await reload();
      if (fresh) {
        write.reset();
        setCheckpoint(fresh);
        if (
          fresh.noShowReportedAt ||
          fresh.sessionId ||
          !['SCHEDULED', 'ACKNOWLEDGED'].includes(fresh.status)
        ) {
          setReporting(false);
          setNote('');
        }
      }
    } finally {
      setReading(false);
    }
  }
  async function close() {
    if (write.busy || reading) return;
    if (note && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return;
    setReporting(false);
    setNote('');
  }
  const errorKey = visitErrorKey(write.error);
  const errors = (
    <>
      {errorKey ? (
        <>
          <Txt style={styles.error}>{t(errorKey)}</Txt>
          <Button
            label={t('requestReconcile')}
            kind="secondary"
            loading={reading}
            onPress={reconcile}
          />
        </>
      ) : (
        <ErrorBox error={write.error} retry={reconcile} />
      )}
      {reporting && <ErrorBox error={readError} />}
    </>
  );
  return (
    <>
      {!reporting && errors}
      {!unavailable && waiting && (
        <Section title={t('noShowReport')} icon="clock">
          <Txt>{t('noShowAwaiting')}</Txt>
          <Info label={t('noShowNote')} value={current.noShowNote} />
        </Section>
      )}
      {!unavailable &&
        (current.sessionId ? (
          <Button
            label={t('viewSession')}
            onPress={() => navigation.navigate('Session', { id: current.sessionId })}
          />
        ) : (
          editable && (
            <Section title={t('visitNextStep')} icon="play-circle">
              <Info
                label={t('visitWindowOpens')}
                value={formatInstant(new Date(window.opens).toISOString(), locale)}
              />
              <Info
                label={t('visitWindowCloses')}
                value={formatInstant(new Date(window.closes).toISOString(), locale)}
              />
              {now < window.opens && <Txt muted>{t('visitWindowWaiting')}</Txt>}
              {(now >= window.closes || now >= Date.parse(current.endAt)) && (
                <Txt muted>{t('visitWindowClosed')}</Txt>
              )}
              {canAcknowledge(current, now) && (
                <Button
                  label={t('acknowledge')}
                  loading={write.busy}
                  disabled={write.uncertain || reading}
                  onPress={() => {
                    write.run(
                      () => repo.acknowledge(current.id),
                      async (fresh) => {
                        setCheckpoint(fresh);
                        await reload();
                      },
                    );
                  }}
                />
              )}
              {startStep !== 'none' && (
                <Button
                  label={
                    startStep === 'waiting'
                      ? t('visitStartOpensAt').replace(
                          '{time}',
                          formatInstant(new Date(window.opens).toISOString(), locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                            hourCycle: 'h23',
                            timeZone: 'Asia/Ho_Chi_Minh',
                          }),
                        )
                      : t('start')
                  }
                  icon="play"
                  loading={write.busy}
                  disabled={write.uncertain || reading || startStep !== 'ready'}
                  onPress={() => {
                    if (careStartStep(current, Date.now()) !== 'ready') return;
                    write.run(
                      async () => sessions.start(current.id, await optionalCoordinates()),
                      (session) => navigation.navigate('Session', { id: session.id }),
                    );
                  }}
                />
              )}
              {canReportNoShow(current, now) && (
                <Button
                  label={t('noShowReport')}
                  kind="secondary"
                  disabled={write.busy || reading}
                  onPress={() => setReporting(true)}
                />
              )}
            </Section>
          )
        ))}
      {reporting && (
        <Modal
          visible
          animationType={reducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            close();
          }}
        >
          <SafeAreaView edges={['top']} style={styles.safe}>
            <Screen>
              <Row>
                <View style={styles.grow}>
                  <Title>{t('noShowReport')}</Title>
                </View>
                <IconButton
                  label={t('close')}
                  icon="x"
                  disabled={write.busy || reading}
                  onPress={() => {
                    close();
                  }}
                />
              </Row>
              <Txt>{t('noShowHint')}</Txt>
              <Field
                label={t('noShowNote')}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
                editable={!write.busy && !reading}
                hint={t('noShowNoteHint')}
                error={note && invalidNote ? t('noShowNoteInvalid') : undefined}
              />
              {errors}
              <Button
                label={t('noShowConfirm')}
                disabled={
                  invalidNote ||
                  write.uncertain ||
                  reading ||
                  unavailable ||
                  !canReportNoShow(current, now)
                }
                loading={write.busy}
                onPress={() => {
                  write.run(
                    () => repo.reportNoShow(current.id, note),
                    async (fresh) => {
                      setCheckpoint(fresh);
                      setReporting(false);
                      setNote('');
                      await reload();
                    },
                  );
                }}
              />
            </Screen>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  grow: { flex: 1 },
  error: { color: colors.danger },
});
