import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { useDirty, useWrite } from '../../core/hooks';
import {
  Button,
  Chips,
  ErrorBox,
  Field,
  IconButton,
  Row,
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
  const { t } = useApp();
  const reducedMotion = useReducedMotion();
  const write = useWrite();
  const [reason, setReason] = useState<'PERSONAL' | 'OTHER'>('PERSONAL');
  const [detail, setDetail] = useState('');
  const [reading, setReading] = useState(false);
  useDirty(!!detail, write.busy);
  const missingDetail = reason === 'OTHER' && !detail.trim();
  const errorKey = visitErrorKey(write.error);
  async function close() {
    if (write.busy || reading) return;
    if (detail && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return;
    onClose();
  }
  async function reconcile() {
    setReading(true);
    try {
      await onDone();
      write.reset();
      onClose();
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
          {kept > 0 && <Txt muted>{t('withdrawKept').replace('{count}', String(kept))}</Txt>}
          <Txt muted>{t('withdrawReason')}</Txt>
          <Chips
            values={(['PERSONAL', 'OTHER'] as const).map((value) => ({
              value,
              label: t('withdraw' + value),
            }))}
            value={reason}
            onChange={(value) => setReason(value === 'OTHER' ? 'OTHER' : 'PERSONAL')}
          />
          <Field
            label={t('withdrawDetail')}
            value={detail}
            onChangeText={setDetail}
            multiline
            maxLength={1000}
            editable={!write.busy && !reading}
            error={missingDetail && detail !== '' ? t('withdrawDetailRequired') : undefined}
            hint={reason === 'OTHER' ? t('withdrawDetailRequired') : undefined}
          />
          {errorKey ? (
            <Txt style={styles.error}>{t(errorKey)}</Txt>
          ) : (
            <ErrorBox error={write.error} retry={write.uncertain ? reconcile : undefined} />
          )}
          {write.uncertain && (
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
            disabled={!visits.length || missingDetail || write.uncertain || reading}
            onPress={() => {
              write.run(
                () =>
                  repo.withdraw(
                    visits.map((visit) => visit.id),
                    reason,
                    detail,
                  ),
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
}: {
  visit: Visit;
  repo: VisitRepository;
  reload: () => Promise<unknown>;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  if (!['SCHEDULED', 'ACKNOWLEDGED'].includes(visit.status) || visit.sessionId) return null;
  return (
    <Section title={t('withdrawTitle')} icon="user-x">
      {visit.needsReassignment ? (
        <Txt>{t('withdrawPending')}</Txt>
      ) : canWithdraw(visit) ? (
        <Button label={t('withdrawOne')} kind="secondary" onPress={() => setOpen(true)} />
      ) : (
        <Txt muted>{t('withdrawTooLate')}</Txt>
      )}
      {open && (
        <WithdrawModal
          visits={[visit]}
          kept={0}
          repo={repo}
          onDone={reload}
          onClose={() => setOpen(false)}
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
