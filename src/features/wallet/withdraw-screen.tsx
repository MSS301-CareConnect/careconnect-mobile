import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Props } from '../../app/routes';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { Button, Card, ErrorBox, Field, PageHeader, RemoteState, Screen, Txt } from '../../core/ui';
import { WithdrawalErrors, WithdrawalForm, validateWithdrawal } from './models';
import { WalletRepository } from './repository';
import { useMoney } from './screen';

const EMPTY: WithdrawalForm = {
  amount: '',
  bankName: '',
  bankAccountNumber: '',
  accountHolderName: '',
};
// PaymentService codes that belong to one field; anything else stays in the error box under the form.
const FIELD_CODES: Record<number, [keyof WithdrawalForm, string]> = {
  6041: ['amount', 'walletAmountTooHigh'],
  6044: ['amount', 'walletAmountRequired'],
  6045: ['amount', 'walletAmountInvalid'],
  6046: ['bankName', 'walletBankRequired'],
  6047: ['bankAccountNumber', 'walletAccountRequired'],
  6048: ['bankAccountNumber', 'walletAccountInvalid'],
  6049: ['accountHolderName', 'walletHolderRequired'],
};
// Withdrawal request (2026-11-09): the balance is read again here; PaymentService holds the amount on success.
export function WalletWithdrawScreen({ navigation }: Props<'WalletWithdraw'>) {
  const { api, t } = useApp();
  const money = useMoney();
  const repo = useMemo(() => new WalletRepository(api), [api]);
  const remote = useRemote(useCallback(() => repo.wallet(), [repo]));
  const write = useWrite();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<WithdrawalErrors>({});
  const [sent, setSent] = useState(false);
  const dirty = !sent && Object.values(form).some((value) => value.trim().length > 0);
  useDirty(dirty, write.busy);
  // Leave only after the sent state rendered, so the unsaved-form guard no longer asks.
  useEffect(() => {
    if (sent) navigation.goBack();
  }, [sent, navigation]);
  const serverField = write.error instanceof ApiError ? FIELD_CODES[write.error.code] : undefined;

  function change(field: keyof WithdrawalForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    write.reset();
  }
  async function submit() {
    if (!remote.data) return;
    const checked = validateWithdrawal(form, remote.data.availableBalance);
    setErrors(checked.errors);
    if (!checked.input) return;
    const input = checked.input;
    await write.run(
      () => repo.requestWithdrawal(input),
      () => setSent(true),
    );
  }
  const errorOf = (field: keyof WithdrawalForm) => {
    const key = errors[field] ?? (serverField?.[0] === field ? serverField[1] : undefined);
    return key ? t(key) : undefined;
  };
  return (
    <Screen>
      <PageHeader title={t('walletWithdrawTitle')} description={t('walletWithdrawHint')} />
      <RemoteState {...remote} retry={() => void remote.reload()}>
        {remote.data && (
          <Card>
            <Field
              label={t('walletAmount')}
              keyboardType="number-pad"
              value={form.amount}
              onChangeText={(value) => change('amount', value)}
              hint={`${t('walletAmountMax')} ${money(remote.data.availableBalance)}`}
              error={errorOf('amount')}
            />
            <Button
              kind="secondary"
              label={t('walletWithdrawAll')}
              disabled={remote.data.availableBalance <= 0}
              onPress={() => change('amount', String(Math.max(0, remote.data!.availableBalance)))}
            />
            <Field
              label={t('walletBankName')}
              value={form.bankName}
              maxLength={100}
              onChangeText={(value) => change('bankName', value)}
              error={errorOf('bankName')}
            />
            <Field
              label={t('walletAccountNumber')}
              keyboardType="number-pad"
              value={form.bankAccountNumber}
              maxLength={20}
              onChangeText={(value) => change('bankAccountNumber', value)}
              error={errorOf('bankAccountNumber')}
            />
            <Field
              label={t('walletHolderName')}
              autoCapitalize="characters"
              value={form.accountHolderName}
              maxLength={100}
              hint={t('walletHolderHint')}
              onChangeText={(value) => change('accountHolderName', value)}
              error={errorOf('accountHolderName')}
            />
            {write.error && !serverField ? <ErrorBox error={write.error} /> : null}
            {write.uncertain ? <Txt muted>{t('uncertain')}</Txt> : null}
            <Button
              icon="send"
              label={t('walletSubmit')}
              loading={write.busy}
              disabled={write.uncertain}
              onPress={() => void submit()}
            />
          </Card>
        )}
      </RemoteState>
    </Screen>
  );
}
