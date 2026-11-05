import React, { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Card,
  Chips,
  IconButton,
  Info,
  PageHeader,
  Pagination,
  RemoteState,
  Screen,
  Title,
  Txt,
} from '../../core/ui';
import { DepositPeriod, depositRange } from './models';
import { KeptDepositRepository } from './repository';
export function KeptDepositsScreen() {
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new KeptDepositRepository(api), [api]);
  const [period, setPeriod] = useState<DepositPeriod>('month');
  const [range, setRange] = useState(() => depositRange('month'));
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(async () => {
      const [summary, rows] = await Promise.all([repo.summary(range), repo.list(range, p)]);
      return { summary, rows };
    }, [repo, range, p]),
  );
  function refresh() {
    setRange(depositRange(period));
    setPage(0);
  }
  const money = (value: number) =>
    new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  return (
    <Screen>
      <PageHeader
        title={t('keptDeposits')}
        description={t('keptDepositsHint')}
        action={
          <IconButton
            label={t('refresh')}
            icon="refresh-cw"
            disabled={remote.loading}
            onPress={refresh}
          />
        }
      />
      <Chips
        values={(['month', 'last30', 'year'] as const).map((value) => ({
          value,
          label: t(
            value === 'month'
              ? 'depositPeriodMonth'
              : value === 'last30'
                ? 'depositPeriodLast30'
                : 'depositPeriodYear',
          ),
        }))}
        value={period}
        onChange={(next) => {
          const value = next as DepositPeriod;
          setPeriod(value);
          setRange(depositRange(value));
          setPage(0);
        }}
      />
      <Txt muted>{t('depositRangeHint')}</Txt>
      <RemoteState {...remote} retry={refresh}>
        {remote.data && (
          <>
            <Card>
              <Txt muted>{t('depositTotal')}</Txt>
              <Title>{money(remote.data.summary.caregiverAmount)}</Title>
              <Info label={t('total')} value={remote.data.rows.totalElements} />
            </Card>
            {!remote.data.rows.items.length && (
              <Card>
                <Txt>{t('depositEmpty')}</Txt>
              </Card>
            )}
            {remote.data.rows.items.map((row) => (
              <Card key={row.id}>
                <Title>{money(row.amount)}</Title>
                <Info
                  label={t('depositVisitAt')}
                  value={formatInstant(row.occurrenceStartAt, locale)}
                />
                <Txt>
                  {t(
                    row.reason === 'CUSTOMER_CANCEL'
                      ? 'depositReasonCustomerCancel'
                      : row.reason === 'PAYMENT_OVERDUE'
                        ? 'depositReasonPaymentOverdue'
                        : 'depositReasonOther',
                  )}
                </Txt>
                <Info label={t('depositRecordedAt')} value={formatInstant(row.createdAt, locale)} />
              </Card>
            ))}
            <Pagination {...remote.data.rows} onChange={setPage} />
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
