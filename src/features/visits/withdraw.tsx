import React, { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant, vietnamDay } from '../../core/time';
import {
  Button,
  Chips,
  ErrorBox,
  Field,
  IconButton,
  Row,
  RemoteState,
  Screen,
  Section,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { canWithdraw, visitErrorKey } from './actions';
import { Visit } from './models';
import { VisitRepository } from './repository';
import { dayWithdrawal, withdrawalBatches } from './booking-days';

/**
 * Caregiver xin hủy một hoặc nhiều buổi của cùng booking (2026-11-09): lý do cá nhân / khác (khác bắt buộc ghi chú).
 * Buổi còn dưới 24h vẫn do caregiver phụ trách. Kết quả chưa rõ → khóa gửi lại tới khi tải lại trạng thái.
 */
export function WithdrawModal({
  visits,
  kept,
  repo,
  onDone,
  onClose,
}: {
  visits: Visit[];
  kept: number;
  repo: VisitRepository;
  onDone: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const { t, locale } = useApp();
  const reducedMotion = useReducedMotion();
  const write = useWrite();
  const [reason, setReason] = useState<'PERSONAL' | 'OTHER'>('PERSONAL');
  const [detail, setDetail] = useState('');
  const [reading, setReading] = useState(false);
  const [sent, setSent] = useState(0);
  const [reloadRequired, setReloadRequired] = useState(false);
  const locked = write.uncertain || reloadRequired || (sent > 0 && !!write.error);
  const dirty = !!detail || reason !== 'PERSONAL';
  useDirty(dirty, write.busy || reading);
  const missingDetail = reason === 'OTHER' && !detail.trim();
  const errorKey = visitErrorKey(write.error);
  async function close() {
    if (write.busy || reading) return;
    if (dirty && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return;
    if (!locked) {
      onClose();
      return;
    }
    setReading(true);
    try {
      await onDone();
    } finally {
      onClose();
    }
  }
  async function reconcile() {
    setReading(true);
    try {
      if (await onDone()) {
        write.reset();
        onClose();
      }
    } finally {
      setReading(false);
    }
  }
  return (
    <Modal visible animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => close()}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Screen>
          <Row>
            <View style={styles.grow}>
              <Title>{t('withdrawTitle')}</Title>
            </View>
            <IconButton
              label={t('close')}
              icon="x"
              disabled={write.busy || reading}
              onPress={() => close()}
            />
          </Row>
          <Txt>{t('withdrawIntro')}</Txt>
          <Txt style={styles.bold}>
            {t('withdrawVisits').replace('{count}', String(visits.length))}
          </Txt>
          {visits.map((visit) => (
            <Txt key={visit.id} muted>
              {formatInstant(visit.startAt, locale, {
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              })}
            </Txt>
          ))}
          {kept > 0 && <Txt muted>{t('withdrawKept').replace('{count}', String(kept))}</Txt>}
          <Txt muted>{t('withdrawReason')}</Txt>
          <Chips
            values={(['PERSONAL', 'OTHER'] as const).map((value) => ({
              value,
              label: t('withdraw' + value),
            }))}
            value={reason}
            onChange={(value) => {
              if (!write.busy && !reading && !locked)
                setReason(value === 'OTHER' ? 'OTHER' : 'PERSONAL');
            }}
          />
          <Field
            label={t('withdrawDetail')}
            value={detail}
            onChangeText={setDetail}
            multiline
            maxLength={1000}
            editable={!write.busy && !reading && !locked}
            error={missingDetail && detail !== '' ? t('withdrawDetailRequired') : undefined}
            hint={reason === 'OTHER' ? t('withdrawDetailRequired') : undefined}
          />
          <ErrorBox error={write.error} messageKey={errorKey} />
          {sent > 0 && (
            <Txt accessibilityLiveRegion="polite">
              {t('withdrawSentCount').replace('{count}', String(sent))}
            </Txt>
          )}
          {reloadRequired && <Txt style={styles.error}>{t('withdrawWholeDayChanged')}</Txt>}
          {locked && (
            <Button
              label={t('requestReconcile')}
              kind="secondary"
              loading={reading}
              onPress={reconcile}
            />
          )}
          <Button
            label={t('withdrawSubmit')}
            kind="danger"
            loading={write.busy}
            disabled={!visits.length || missingDetail || locked || reading}
            onPress={() => {
              if (!visits.every((visit) => canWithdraw(visit))) {
                setReloadRequired(true);
                return;
              }
              write.run(
                async () => {
                  for (const batch of withdrawalBatches(visits)) {
                    const count = await repo.withdraw(
                      batch.map((visit) => visit.id),
                      reason,
                      detail,
                    );
                    setSent((value) => value + count);
                  }
                },
                async () => {
                  setDetail('');
                  await onDone();
                  onClose();
                },
              );
            }}
          />
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}

/** Mục xin hủy trong chi tiết buổi: nút khi còn hơn 24h, trạng thái chờ thay người, hoặc lý do không hủy được. */
export function VisitWithdrawSection({
  visit,
  repo,
  reload,
  unavailable,
}: {
  visit: Visit;
  repo: VisitRepository;
  reload: () => Promise<unknown>;
  unavailable: boolean;
}) {
  if (!['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) || visit.sessionId) return null;
  return (
    <VisitDayWithdrawal
      key={visit.id}
      visit={visit}
      repo={repo}
      reload={reload}
      unavailable={unavailable}
    />
  );
}

function VisitDayWithdrawal({
  visit,
  repo,
  reload,
  unavailable,
}: {
  visit: Visit;
  repo: VisitRepository;
  reload: () => Promise<unknown>;
  unavailable: boolean;
}) {
  const { t } = useApp();
  const day = vietnamDay(new Date(visit.startAt));
  const remote = useRemote(
    useCallback(
      () =>
        visit.needsReassignment ? Promise.resolve([]) : repo.bookingVisits(visit.bookingId, day),
      [repo, visit.bookingId, visit.needsReassignment, day],
    ),
  );
  const [selected, setSelected] = useState<Visit[]>();
  const visits = (remote.data ?? []).filter((item) => vietnamDay(new Date(item.startAt)) === day);
  const plan = dayWithdrawal(visits, Date.now());
  return (
    <Section title={t('withdrawTitle')} icon="user-x">
      {visit.needsReassignment ? (
        <Txt>{t('withdrawPending')}</Txt>
      ) : (
        <RemoteState {...remote} retry={remote.reload}>
          {plan.allowed &&
          plan.visits.length <= 60 &&
          plan.visits.some((item) => item.id === visit.id) ? (
            <Button
              label={t(plan.visits.length > 1 ? 'withdrawDay' : 'withdrawOne')}
              kind="secondary"
              disabled={unavailable}
              onPress={() => setSelected(plan.visits)}
            />
          ) : (
            <Txt muted>
              {t(
                plan.visits.length > 60
                  ? 'withdrawDayLimit'
                  : plan.visits.length > 1
                    ? 'withdrawTooLateDay'
                    : 'withdrawTooLate',
              )}
            </Txt>
          )}
        </RemoteState>
      )}
      {selected && (
        <WithdrawModal
          visits={selected}
          kept={0}
          repo={repo}
          onDone={async () => {
            const siblings = await remote.reload();
            const updated = await reload();
            return siblings && updated;
          }}
          onClose={() => setSelected(undefined)}
        />
      )}
    </Section>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  grow: { flex: 1 },
  bold: { fontWeight: '700' },
  error: { color: colors.danger },
});
