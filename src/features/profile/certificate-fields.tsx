import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useApp } from '../../core/app-context';
import { Field, IconButton, Txt, colors } from '../../core/ui';
import { CertificateDraft, validCertificateDate } from './models';

export type CertificateFieldErrors = Partial<Record<keyof CertificateDraft, string>>;

export function certificateFieldErrors(draft: CertificateDraft): CertificateFieldErrors {
  const errors: CertificateFieldErrors = {};
  for (const key of ['name', 'issuedBy'] as const) {
    if (!draft[key].trim()) errors[key] = 'certRequired';
    else if (draft[key].length > 255) errors[key] = 'certTooLong';
  }
  if (draft.credential.length > 255) errors.credential = 'certTooLong';
  for (const key of ['issuedDate', 'expiryDate'] as const) {
    if (!validCertificateDate(draft[key])) errors[key] = 'certInvalidDate';
  }
  if (
    !errors.issuedDate &&
    !errors.expiryDate &&
    draft.issuedDate &&
    draft.expiryDate &&
    draft.expiryDate < draft.issuedDate
  )
    errors.expiryDate = 'certDatesOrder';
  return errors;
}

export function CertificateFields({
  draft,
  disabled,
  errors,
  onChange,
  onBlur,
  onPickDate,
}: {
  draft: CertificateDraft;
  disabled: boolean;
  errors: CertificateFieldErrors;
  onChange: (key: keyof CertificateDraft, value: string) => void;
  onBlur: (key: keyof CertificateDraft) => void;
  onPickDate: (key: 'issuedDate' | 'expiryDate') => void;
}) {
  const { t } = useApp();
  return (
    <View style={styles.fields}>
      <Txt accessibilityRole="header" style={styles.heading}>
        {t('certDetailsHeading')}
      </Txt>
      <Txt muted>{t('certRequiredHint')}</Txt>
      {(['name', 'issuedBy', 'credential'] as const).map((key) => (
        <Field
          key={key}
          label={t(
            key === 'name'
              ? 'certNameRequired'
              : key === 'issuedBy'
                ? 'certIssuerRequired'
                : 'certCredential',
          )}
          value={draft[key]}
          maxLength={255}
          editable={!disabled}
          onChangeText={(value) => onChange(key, value)}
          onBlur={() => onBlur(key)}
          error={errors[key] && t(errors[key])}
          autoCapitalize={key === 'credential' ? 'none' : 'sentences'}
          autoCorrect={key !== 'credential'}
          hint={key === 'credential' ? t('certOptionalHint') : undefined}
        />
      ))}
      <View style={styles.dates}>
        {(['issuedDate', 'expiryDate'] as const).map((key) => (
          <View key={key} style={styles.date}>
            <Field
              label={t(key === 'issuedDate' ? 'certIssueDate' : 'certExpiryDate')}
              hint={t(key === 'issuedDate' ? 'certDateHint' : 'certExpiryHint')}
              value={draft[key]}
              editable={!disabled}
              maxLength={10}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="YYYY-MM-DD"
              onChangeText={(value) => onChange(key, value)}
              onBlur={() => onBlur(key)}
              error={errors[key] && t(errors[key])}
              trailing={
                <IconButton
                  label={
                    t('certChooseDate') +
                    ': ' +
                    t(key === 'issuedDate' ? 'certIssueDate' : 'certExpiryDate')
                  }
                  icon="calendar"
                  disabled={disabled}
                  onPress={() => onPickDate(key)}
                />
              }
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.ink },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  date: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
});
