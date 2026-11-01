import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../core/app-context';
import { ApiError } from '../../core/api';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Info,
  RemoteState,
  Screen,
  Section,
  Title,
  Txt,
} from '../../core/ui';
import { Props } from '../../app/routes';
import { hasActiveRegistration, registrationBlockReason } from './models';
import { WorkShiftRepository } from './repository';
import { RegistrationStatus, ShiftSummary } from './card';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new WorkShiftRepository(api), [api]);
}
const errorKeys: Record<number, string> = {
  4202: 'workShiftEligibility',
  4203: 'workShiftEligibility',
  4301: 'conflict',
  4304: 'workShiftNotOpen',
  4305: 'workShiftFull',
  4308: 'workShiftStarted',
  4351: 'workShiftAlreadyRegistered',
  4352: 'workShiftPendingOnly',
  4354: 'workShiftDeadlinePassed',
};
export function WorkShiftScreen({ route }: Props<'WorkShift'>) {
  const { t } = useApp();
  const { id } = route.params;
  const repo = useRepo();
  const remote = useRemote(useCallback(() => repo.detail(id), [repo, id]));
  const write = useWrite();
  const [note, setNote] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('');
  useDirty(note.trim().length > 0, write.busy);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locked = write.busy || write.uncertain || remote.loading;
  async function reconcile() {
    const fresh = await remote.reload();
    if (fresh) {
      if (
        hasActiveRegistration(fresh.registration) &&
        fresh.registration?.caregiverNote === note.trim()
      )
        setNote('');
      setCancelConfirm(false);
      write.reset();
    }
  }
  const data = remote.data;
  const registration = data?.registration;
  const active = hasActiveRegistration(data?.registration);
  const blockReason = data?.shift
    ? registrationBlockReason(data.shift, data.registration, data.eligible, now)
    : undefined;
  const errorKey = write.error instanceof ApiError ? errorKeys[write.error.code] : undefined;
  return (
    <Screen>
      <Title>{t('workShiftDetails')}</Title>
      <RemoteState {...remote} retry={reconcile}>
        {data && (
          <>
            <Card>
              {data.shift ? (
                <>
                  <ShiftSummary shift={data.shift} details />
                  <Info label={t('workShiftNote')} value={data.shift.note} />
                </>
              ) : (
                <Txt muted>{t('workShiftUnavailable')}</Txt>
              )}
            </Card>
            {registration && (
              <Section title={t('workShiftRegistration')}>
                <RegistrationStatus registration={registration} />
                <Info label={t('workShiftRegistrationNote')} value={registration.caregiverNote} />
                <Info label={t('workShiftRejectionReason')} value={registration.rejectionReason} />
                {registration.status === 'APPROVED' && (
                  <Txt muted>{t('workShiftApprovedHint')}</Txt>
                )}
                {registration.status === 'PENDING' &&
                  (cancelConfirm ? (
                    <Card>
                      <Txt>{t('workShiftCancelQuestion')}</Txt>
                      <Button
                        label={t('workShiftConfirmCancel')}
                        kind="danger"
                        disabled={locked}
                        loading={write.busy}
                        onPress={() =>
                          void write.run(
                            () => repo.cancel(registration),
                            async () => {
                              setNotice('workShiftCancelled');
                              setCancelConfirm(false);
                              await remote.reload();
                            },
                          )
                        }
                      />
                      <Button
                        label={t('workShiftKeepRegistration')}
                        kind="secondary"
                        disabled={locked}
                        onPress={() => setCancelConfirm(false)}
                      />
                    </Card>
                  ) : (
                    <Button
                      label={t('workShiftCancel')}
                      kind="danger"
                      disabled={locked}
                      onPress={() => setCancelConfirm(true)}
                    />
                  ))}
              </Section>
            )}
            {!active && data.shift && (
              <Section title={t('workShiftRegistration')}>
                {blockReason && <Txt muted>{t(blockReason)}</Txt>}
                <Field
                  label={t('workShiftRegistrationNote')}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={2000}
                  editable={!locked}
                />
                <Txt muted>{t('workShiftNoteLimit')}</Txt>
                <Button
                  label={t('workShiftRegister')}
                  icon="calendar"
                  loading={write.busy}
                  disabled={locked || !!blockReason || note.length > 2000}
                  onPress={() =>
                    void write.run(
                      () => repo.register(id, note),
                      async () => {
                        setNote('');
                        setNotice('workShiftRegistered');
                        await remote.reload();
                      },
                    )
                  }
                />
              </Section>
            )}
            {active && note.trim().length > 0 && (
              <Card>
                <Info label={t('workShiftRetainedNote')} value={note} />
                <Button
                  label={t('workShiftDiscardNote')}
                  kind="secondary"
                  disabled={locked}
                  onPress={() => setNote('')}
                />
              </Card>
            )}
            {notice !== '' && <Txt>{t(notice)}</Txt>}
            {errorKey && <Txt muted>{t(errorKey)}</Txt>}
            <ErrorBox error={write.error} retry={reconcile} />
            {!write.error && (
              <Button
                label={t('refresh')}
                kind="secondary"
                disabled={write.busy}
                onPress={() => void reconcile()}
              />
            )}
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
