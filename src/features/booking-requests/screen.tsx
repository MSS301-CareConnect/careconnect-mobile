import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Props } from '../../app/routes';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  IconButton,
  Info,
  PageHeader,
  Pagination,
  RemoteState,
  Row,
  Screen,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { BookingRequest, canAnswerRequest } from './models';
import { BookingRequestRepository } from './repository';

export function BookingRequestsScreen({ route }: Props<'BookingRequests'>) {
  const { api, t, locale } = useApp();
  const reducedMotion = useReducedMotion();
  const repo = useMemo(() => new BookingRequestRepository(api), [api]);
  const [p, setPage] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [selected, setSelected] = useState<{
    request: BookingRequest;
    kind: 'accept' | 'decline';
  }>();
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<unknown>();
  const load = useCallback(async () => {
    const result = await repo.list(p);
    const id = route.params?.bookingId;
    const linked =
      id && !result.items.some((item) => item.id === id) ? await repo.findPending(id) : undefined;
    return { ...result, linked };
  }, [repo, p, route.params?.bookingId]);
  const remote = useRemote(load);
  const write = useWrite();
  useDirty(!!selected && selected.kind === 'decline' && !!reason, write.busy);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  async function close() {
    if (write.busy || reading) return;
    if (
      selected?.kind === 'decline' &&
      reason &&
      !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel')))
    )
      return;
    setSelected(undefined);
    setReason('');
  }
  async function reconcile() {
    if (reading || write.busy) return;
    setReading(true);
    setReadError(undefined);
    try {
      if (target) {
        const fresh = await repo.findPending(target);
        if (fresh)
          setSelected((current) =>
            current?.request.id === target ? { ...current, request: fresh } : current,
          );
        else {
          setAnswered((current) => new Set(current).add(target));
          setSelected((current) =>
            current?.request.id === target && current.kind === 'accept' ? undefined : current,
          );
          setMessage('requestUnavailable');
        }
        write.reset();
        setTarget('');
      }
      await remote.reload();
    } catch (error) {
      setReadError(error);
    } finally {
      setReading(false);
    }
  }
  async function decide() {
    if (!selected || write.uncertain || !canAnswerRequest(selected.request)) return;
    const { request, kind } = selected;
    setTarget(request.id);
    setMessage('');
    await write.run(
      () => (kind === 'accept' ? repo.accept(request.id) : repo.decline(request.id, reason)),
      async (result) => {
        setAnswered((current) => new Set(current).add(result.id));
        setMessage(
          result.status === 'AWAITING_INITIAL_PAYMENT'
            ? 'requestAccepted'
            : result.status === 'PENDING_CAREGIVER_ASSIGNMENT'
              ? 'requestHandedOver'
              : 'requestDeclined',
        );
        setSelected(undefined);
        setReason('');
        setTarget('');
        await remote.reload();
      },
    );
  }
  const invalidReason = !reason.trim() || reason.trim().length > 1000;
  const unavailable = write.error instanceof ApiError && [5116, 5101].includes(write.error.code);
  const errors = (
    <>
      {unavailable ? (
        <Txt style={styles.error}>{t('requestUnavailable')}</Txt>
      ) : (
        <ErrorBox error={write.error} />
      )}
      <ErrorBox error={readError} />
      {(write.uncertain || !!readError) && (
        <Button
          label={t('requestReconcile')}
          kind="secondary"
          loading={reading}
          onPress={reconcile}
        />
      )}
    </>
  );
  const items = remote.data
    ? [...(remote.data.linked ? [remote.data.linked] : []), ...remote.data.items].filter(
        (item) => !answered.has(item.id),
      )
    : [];
  return (
    <Screen>
      <PageHeader
        title={t('bookingRequests')}
        description={t('bookingRequestsHint')}
        action={
          <IconButton
            label={t('requestRefreshList')}
            icon="refresh-cw"
            disabled={remote.loading || reading || write.busy}
            onPress={reconcile}
          />
        }
      />
      {!!message && (
        <Card>
          <Txt>{t(message)}</Txt>
        </Card>
      )}
      {!selected && errors}
      <RemoteState {...remote} retry={reconcile}>
        {remote.data && (
          <>
            {!items.length && (
              <Card>
                <Txt>{t('requestsEmpty')}</Txt>
              </Card>
            )}
            {items.map((request) => (
              <Card key={request.id}>
                <Row>
                  <Txt style={styles.code}>{request.bookingCode}</Txt>
                  <Badge status={request.status} />
                </Row>
                <Txt muted>{t(`requestKind${request.bookingType}`)}</Txt>
                <Info
                  label={t('requestAnswerBy')}
                  value={formatInstant(request.acceptanceDueAt, locale)}
                />
                {!!request.occurrences[0] && (
                  <Title>{formatInstant(request.occurrences[0].startAt, locale)}</Title>
                )}
                <Info label={t('requestVisits')} value={request.occurrences.length} />
                <Info label={t('requestArea')} value={request.area} />
                <Info label={t('requestRecipientAge')} value={request.recipientAge} />
                {['MALE', 'FEMALE', 'OTHER'].includes(request.recipientGender) && (
                  <Info label={t('requestRecipientGender')} value={t(request.recipientGender)} />
                )}
                <Info label={t('services')} value={request.services.join(', ')} />
                <Info
                  label={t('requestBookingPrice')}
                  value={
                    request.totalAmount === undefined
                      ? undefined
                      : new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                          style: 'currency',
                          currency: 'VND',
                          maximumFractionDigits: 0,
                        }).format(request.totalAmount)
                  }
                />
                <Info label={t('customerNote')} value={request.customerNote} />
                {request.occurrences.length > 1 && (
                  <Button
                    kind="secondary"
                    label={t(expanded.has(request.id) ? 'requestHideVisits' : 'requestShowVisits')}
                    onPress={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(request.id)) next.delete(request.id);
                        else next.add(request.id);
                        return next;
                      })
                    }
                  />
                )}
                {expanded.has(request.id) &&
                  request.occurrences.map((visit) => (
                    <Txt key={visit.id}>
                      {formatInstant(visit.startAt, locale)} –{' '}
                      {formatInstant(visit.endAt, locale, { hour: '2-digit', minute: '2-digit' })}
                    </Txt>
                  ))}
                <Txt muted>{t('requestPrivacy')}</Txt>
                {!canAnswerRequest(request, now) && (
                  <Txt style={styles.error}>{t('requestExpiredLocal')}</Txt>
                )}
                <Button
                  label={t('requestAccept')}
                  icon="check"
                  disabled={
                    write.busy ||
                    reading ||
                    (write.uncertain && target !== request.id) ||
                    !canAnswerRequest(request, now)
                  }
                  onPress={() => {
                    setSelected({ request, kind: 'accept' });
                    setReason('');
                  }}
                />
                <Button
                  label={t('requestDecline')}
                  kind="secondary"
                  disabled={
                    write.busy ||
                    reading ||
                    (write.uncertain && target !== request.id) ||
                    !canAnswerRequest(request, now)
                  }
                  onPress={() => {
                    setSelected({ request, kind: 'decline' });
                    setReason('');
                  }}
                />
              </Card>
            ))}
            <Pagination {...remote.data} onChange={setPage} />
          </>
        )}
      </RemoteState>
      {selected && (
        <Modal
          visible
          animationType={reducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            close();
          }}
        >
          <SafeAreaView style={styles.safe} edges={['top']}>
            <Screen>
              <Row>
                <View style={styles.grow}>
                  <Title>
                    {t(
                      selected?.kind === 'accept'
                        ? 'requestAcceptConfirm'
                        : 'requestDeclineConfirm',
                    )}
                  </Title>
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
              <Txt>
                {t(selected?.kind === 'accept' ? 'requestAcceptHint' : 'requestDeclineHint')}
              </Txt>
              {answered.has(selected.request.id) && (
                <Txt style={styles.error}>{t('requestUnavailable')}</Txt>
              )}
              {selected?.kind === 'decline' && (
                <Field
                  label={t('requestDeclineReason')}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={1000}
                  editable={!write.busy && !reading}
                  hint={t('requestReasonHint')}
                  error={reason && invalidReason ? t('requestReasonInvalid') : undefined}
                />
              )}
              {errors}
              <Button
                label={t(
                  selected?.kind === 'accept' ? 'requestAcceptConfirm' : 'requestDeclineConfirm',
                )}
                disabled={
                  write.uncertain ||
                  reading ||
                  (selected?.kind === 'decline' && invalidReason) ||
                  !selected ||
                  answered.has(selected.request.id) ||
                  !canAnswerRequest(selected.request, now)
                }
                loading={write.busy}
                onPress={() => {
                  decide();
                }}
              />
            </Screen>
          </SafeAreaView>
        </Modal>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  grow: { flex: 1 },
  code: { fontWeight: '700' },
  error: { color: colors.danger },
});
