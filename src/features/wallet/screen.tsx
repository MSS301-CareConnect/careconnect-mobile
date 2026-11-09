import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Props } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  Chips,
  IconButton,
  Info,
  PageHeader,
  Pagination,
  RemoteState,
  Screen,
  Section,
  Title,
  Txt,
  colors,
} from '../../core/ui';
import {
  WalletPeriod,
  WalletSeriesPoint,
  WithdrawalStatus,
  maskAccount,
  transactionSign,
  walletRange,
} from './models';
import { WalletRepository } from './repository';

const STATUS_TONES: Record<WithdrawalStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  COMPLETED: 'success',
};
export function useMoney() {
  const { locale } = useApp();
  return useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(value),
    [locale],
  );
}
// "2026-11-09" → "09/11", "2026-11" → "11/2026".
function periodLabel(period: string) {
  const [year, month, day] = period.split('-');
  return day ? `${day}/${month}` : `${month}/${year}`;
}
function WalletChart({ series }: { series: WalletSeriesPoint[] }) {
  const { t } = useApp();
  const money = useMoney();
  const max = Math.max(0, ...series.map((point) => point.income));
  if (max === 0) return <Txt muted>{t('walletChartEmpty')}</Txt>;
  return (
    <View style={styles.chart} accessibilityLabel={t('walletChart')}>
      {series.map((point) => (
        <View
          key={point.period}
          style={styles.barSlot}
          accessible
          accessibilityLabel={`${periodLabel(point.period)}: ${money(point.income)}`}
        >
          <View style={[styles.bar, { height: `${(Math.max(0, point.income) / max) * 100}%` }]} />
        </View>
      ))}
    </View>
  );
}
// Caregiver wallet (2026-11-09): balance, period dashboard, ledger and own withdrawal requests.
export function WalletScreen({ navigation }: Props<'Wallet'>) {
  const { api, t, locale } = useApp();
  const money = useMoney();
  const repo = useMemo(() => new WalletRepository(api), [api]);
  const [period, setPeriod] = useState<WalletPeriod>('month');
  const [range, setRange] = useState(() => walletRange('month'));
  const [transactionPage, setTransactionPage] = useState(0);
  const [withdrawalPage, setWithdrawalPage] = useState(0);
  const remote = useRemote(
    useCallback(async () => {
      const [wallet, statistics, transactions, withdrawals] = await Promise.all([
        repo.wallet(),
        repo.statistics(range),
        repo.transactions(range, transactionPage),
        repo.withdrawals(withdrawalPage),
      ]);
      return { wallet, statistics, transactions, withdrawals };
    }, [repo, range, transactionPage, withdrawalPage]),
  );
  function choose(next: WalletPeriod) {
    setPeriod(next);
    setRange(walletRange(next));
    setTransactionPage(0);
  }
  return (
    <Screen>
      <PageHeader
        title={t('wallet')}
        description={t('walletHint')}
        action={
          <IconButton
            label={t('refresh')}
            icon="refresh-cw"
            disabled={remote.loading}
            onPress={() => choose(period)}
          />
        }
      />
      <RemoteState {...remote} retry={() => choose(period)}>
        {remote.data && (
          <>
            <Card>
              <Txt muted>{t('walletAvailable')}</Txt>
              <Title>{money(remote.data.wallet.availableBalance)}</Title>
              <Info label={t('walletHeld')} value={money(remote.data.wallet.heldBalance)} />
              <Txt muted>{t('walletHeldHint')}</Txt>
              <Button
                icon="send"
                label={t('walletWithdraw')}
                disabled={!remote.data.wallet.withdrawable}
                onPress={() => navigation.navigate('WalletWithdraw')}
              />
              {!remote.data.wallet.withdrawable && <Txt muted>{t('walletNotWithdrawable')}</Txt>}
            </Card>
            <Chips
              values={(['month', 'last30', 'year'] as const).map((value) => ({
                value,
                label: t(
                  value === 'month'
                    ? 'walletPeriodMonth'
                    : value === 'last30'
                      ? 'walletPeriodLast30'
                      : 'walletPeriodYear',
                ),
              }))}
              value={period}
              onChange={(next) => choose(next as WalletPeriod)}
            />
            <Section title={t('walletDashboard')} icon="trending-up">
              <Info
                label={t('walletForfeitIncome')}
                value={money(remote.data.statistics.forfeitIncome)}
              />
              <Info label={t('walletBookingCount')} value={remote.data.statistics.bookingCount} />
              <Info
                label={t('walletTotalWithdrawn')}
                value={money(remote.data.statistics.totalWithdrawn)}
              />
              <Txt style={styles.subheading}>{t('walletChart')}</Txt>
              <WalletChart series={remote.data.statistics.series} />
            </Section>
            <Section title={t('walletTransactions')} icon="list">
              {!remote.data.transactions.items.length && (
                <Txt muted>{t('walletTransactionsEmpty')}</Txt>
              )}
              {remote.data.transactions.items.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Txt style={styles.strong}>{t(`walletType_${row.type}`)}</Txt>
                    <Txt muted>{formatInstant(row.createdAt, locale)}</Txt>
                  </View>
                  <View style={styles.rowAmount}>
                    <Txt
                      style={[
                        styles.strong,
                        transactionSign(row.type) > 0 ? { color: colors.primary } : undefined,
                      ]}
                    >
                      {transactionSign(row.type) > 0 ? '+' : '−'}
                      {money(row.amount)}
                    </Txt>
                    <Txt muted>
                      {t('walletBalanceAfter')}: {money(row.availableAfter)}
                    </Txt>
                  </View>
                </View>
              ))}
              {remote.data.transactions.totalPages > 1 && (
                <Pagination {...remote.data.transactions} onChange={setTransactionPage} />
              )}
            </Section>
            <Section title={t('walletWithdrawals')} icon="credit-card">
              {!remote.data.withdrawals.items.length && (
                <Txt muted>{t('walletWithdrawalsEmpty')}</Txt>
              )}
              {remote.data.withdrawals.items.map((row) => (
                <View key={row.id} style={styles.withdrawal}>
                  <View style={styles.row}>
                    <Txt style={styles.strong}>{money(row.amount)}</Txt>
                    <Badge status={`walletStatus_${row.status}`} tone={STATUS_TONES[row.status]} />
                  </View>
                  <Txt muted>
                    {row.bankName} · {maskAccount(row.bankAccountNumber)} · {row.accountHolderName}
                  </Txt>
                  <Txt muted>{formatInstant(row.createdAt, locale)}</Txt>
                  <Info label={t('walletRejectReason')} value={row.rejectReason} />
                  <Info label={t('walletTransferReference')} value={row.transferReference} />
                </View>
              ))}
              {remote.data.withdrawals.totalPages > 1 && (
                <Pagination {...remote.data.withdrawals} onChange={setWithdrawalPage} />
              )}
            </Section>
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  subheading: { fontWeight: '600', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowAmount: { alignItems: 'flex-end', gap: 2 },
  strong: { fontWeight: '600' },
  withdrawal: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
