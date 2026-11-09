import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Props } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { Button, Card, RemoteState, Screen, Title, Txt } from '../../core/ui';
import { canWithdraw } from './actions';
import { VisitCard } from './card';
import { VisitRepository } from './repository';
import { WithdrawModal } from './withdraw';

const AHEAD = ['SCHEDULED', 'ACKNOWLEDGED', 'IN_PROGRESS'];

/**
 * Mọi buổi của caregiver trong một booking (2026-11-09, như trang booking của FE): sắp tới trước, rồi đã qua / đã đóng;
 * "Xin hủy các buổi còn lại" gửi các buổi còn hơn 24h trong một lần.
 */
export function BookingVisitsScreen({ route }: Props<'BookingVisits'>) {
  const { api, t } = useApp();
  const repo = useMemo(() => new VisitRepository(api), [api]);
  const { bookingId, code, name } = route.params;
  const remote = useRemote(useCallback(() => repo.bookingVisits(bookingId), [repo, bookingId]));
  const [withdrawing, setWithdrawing] = useState(false);
  const visits = remote.data ?? [];
  const ahead = visits.filter((visit) => AHEAD.includes(visit.status));
  const past = visits.filter((visit) => !AHEAD.includes(visit.status)).reverse();
  const [now] = useState(Date.now);
  const withdrawable = ahead.filter((visit) => canWithdraw(visit, now));
  const kept = ahead.filter(
    (visit) =>
      !canWithdraw(visit, now) && !visit.needsReassignment && visit.status !== 'IN_PROGRESS',
  ).length;
  return (
    <Screen>
      <View style={styles.heading}>
        {code ? <Txt muted>{code}</Txt> : null}
        <Title>{name || visits[0]?.name || t('bookingVisitsTitle')}</Title>
      </View>
      <RemoteState {...remote} retry={remote.reload}>
        {remote.data && (
          <>
            {withdrawable.length > 0 && (
              <Button
                label={t('withdrawRemaining')}
                kind="secondary"
                icon="user-x"
                onPress={() => setWithdrawing(true)}
              />
            )}
            <Txt style={styles.section}>{t('bookingUpcoming')}</Txt>
            {ahead.length ? (
              ahead.map((visit) => <VisitCard key={visit.id} visit={visit} />)
            ) : (
              <Card>
                <Txt muted>{t('bookingNoUpcoming')}</Txt>
              </Card>
            )}
            {past.length > 0 && (
              <>
                <Txt style={styles.section}>{t('bookingPast')}</Txt>
                {past.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} />
                ))}
              </>
            )}
          </>
        )}
      </RemoteState>
      {withdrawing && (
        <WithdrawModal
          visits={withdrawable}
          kept={kept}
          repo={repo}
          onDone={remote.reload}
          onClose={() => setWithdrawing(false)}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { gap: 4 },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '700', paddingTop: 8 },
});
