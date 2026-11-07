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
import {
  hasActiveRegistration,
  Registration,
  registrationBlockReason,
  registrationShift,
} from './models';
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
  4355: 'workShiftTimeOffConflict',
  4401: 'workShiftScheduleConflict',
  4116: 'workShiftCenterInactive',
};
export function WorkShiftScreen({ route, navigation }: Props<'WorkShift'>) {
  const { t } = useApp();
  const { id } = route.params;
  const repo = useRepo();
  const remote = useRemote(useCallback(() => repo.detail(id), [repo, id]));
  const write = useWrite();
  const [note, setNote] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('');
  const [savedRegistration, setSavedRegistration] = useState<Registration>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useDirty(note.trim().length > 0, write.busy);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locked = write.busy || write.uncertain || remote.loading || !!remote.error || needsRefresh;
  async function reconcile() {
    const fresh = await remote.reload();
    if (fresh) {
      if (
        hasActiveRegistration(fresh.registration) &&
        fresh.registration?.caregiverNote === note.trim()
      )
        setNote('');
      setCancelConfirm(false);
      setSavedRegistration(undefined);
      setNeedsRefresh(false);
      write.reset();
    }
  }
  const data = remote.data;
  const registration = savedRegistration ?? data?.registration;
  const summary = data?.shift ?? (registration ? registrationShift(registration) : undefined);
  const active = hasActiveRegistration(registration);
  const blockReason = data?.shift
    ? registrationBlockReason(data.shift, registration, data.eligible, now)
    : undefined;
  const errorKey = write.error instanceof ApiError ? errorKeys[write.error.code] : undefined;
  return (
    <Screen>
      <Title>{t('workShiftDetails')}</Title>
      {data && <ErrorBox error={remote.error} retry={reconcile} />}
      <RemoteState
        loading={remote.loading && !data}
        error={data ? undefined : remote.error}
        retry={reconcile}
      >
        {data && (
          <>
            <Card>
              {summary ? (
                <>
                  <ShiftSummary shift={summary} details />
                  {!!data.shift?.note && (
                    <Info label={t('workShiftNote')} value={data.shift.note} />
                  )}
                </>
              ) : (
                <Txt muted>{t('workShiftUnavailable')}</Txt>
              )}
            </Card>
            {registration && (
              <Section title={t('workShiftRegistration')}>
                <RegistrationStatus registration={registration} />
                {registration.status === 'PENDING' && (
                  <>
                    <Txt accessibilityLiveRegion="polite">{t('workPendingReviewHint')}</Txt>
                    <Button
                      kind="secondary"
                      label={t('workViewPending')}
                      disabled={write.busy}
                      onPress={() =>
                        navigation.navigate('Tabs', {
                          screen: 'Availability',
                          params: { section: 'register', registrationView: 'pending' },
                        })
                      }
                    />
                  </>
                )}
                <Info label={t('workShiftRegistrationNote')} value={registration.caregiverNote} />
                <Info label={t('workShiftRejectionReason')} value={registration.rejectionReason} />
                {registration.status === 'APPROVED' && (
                  <>
                    <Txt muted>{t('workShiftApprovedHint')}</Txt>
                    {registration.scheduleId &&
                      registration.scheduleStatus === 'SCHEDULED' &&
                      registration.scheduleVersion !== undefined && (
                        <Button
                          kind="danger"
                          label={t('workShiftWithdraw')}
                          disabled={locked}
                          onPress={() =>
                            navigation.navigate('ProviderSchedule', {
                              scheduleId: registration.scheduleId,
                              cancel: true,
                            })
                          }
                        />
                      )}
                  </>
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
                <Txt muted>{t('workSubmitHint')}</Txt>
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
                  label={t('workSubmitRegistration')}
                  icon="calendar"
                  loading={write.busy}
                  disabled={locked || !!blockReason || note.length > 2000}
                  onPress={() =>
                    void write.run(
                      () => repo.register(id, note),
                      async (result) => {
                        setSavedRegistration(result);
                        setNeedsRefresh(true);
                        setNote('');
                        setNotice('');
                        const fresh = await remote.reload();
                        if (fresh) {
                          setSavedRegistration(undefined);
                          setNeedsRefresh(false);
                        }
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
            {needsRefresh && (
              <Txt accessibilityLiveRegion="polite">{t('workRegistrationRefreshRequired')}</Txt>
            )}
            <ErrorBox error={write.error} messageKey={errorKey} retry={reconcile} />
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
