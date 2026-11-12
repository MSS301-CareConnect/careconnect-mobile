import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { pickCalendarDate } from '../../core/date-picker';
import { Chips, Field, Txt, colors } from '../../core/ui';
import {
  displayVisitDate,
  VisitDateFields,
  VisitPeriod,
  visitDateInput,
  visitPeriodOptions,
} from './period';

export function VisitDateFilter({
  period,
  dates,
  error,
  onChange,
  onDates,
  onReset,
}: {
  period?: VisitPeriod;
  dates: VisitDateFields;
  error?: string;
  onChange: (period: VisitPeriod) => void;
  onDates: (dates: VisitDateFields) => void;
  onReset?: () => void;
}) {
  const { t } = useApp();
  const { width, fontScale } = useWindowDimensions();
  const pending = useRef(false);
  const [picking, setPicking] = useState(false);
  const [pickerError, setPickerError] = useState(false);
  const labels = { from: t('visitPeriodFrom'), to: t('visitPeriodTo') };

  async function pick(field: keyof VisitDateFields) {
    if (pending.current) return;
    Keyboard.dismiss();
    pending.current = true;
    setPicking(true);
    setPickerError(false);
    try {
      const date = await pickCalendarDate(
        visitDateInput(dates[field]) ?? '',
        labels[field],
        t('applyFilters'),
        t('cancel'),
      );
      if (date) onDates({ ...dates, [field]: displayVisitDate(date) });
    } catch {
      setPickerError(true);
    } finally {
      pending.current = false;
      setPicking(false);
    }
  }

  return (
    <View style={styles.filter}>
      <Chips
        value={period ?? ''}
        values={visitPeriodOptions.map(({ value, label }) => ({ value, label: t(label) }))}
        onChange={(value) => {
          const option = visitPeriodOptions.find((item) => item.value === value);
          if (!option || pending.current) return;
          Keyboard.dismiss();
          setPickerError(false);
          onChange(option.value);
        }}
      />
      {period === 'custom' && (
        <View style={[styles.fields, (width < 350 || fontScale >= 1.25) && styles.stack]}>
          {(['from', 'to'] as const).map((field) => (
            <View key={field} style={styles.field}>
              <Field
                label={labels[field]}
                value={dates[field]}
                maxLength={10}
                placeholder="DD/MM/YYYY"
                editable={!picking}
                onChangeText={(value) => onDates({ ...dates, [field]: value })}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      field === 'from' ? 'visitPeriodPickFrom' : 'visitPeriodPickTo',
                    )}
                    accessibilityState={{ disabled: picking }}
                    disabled={picking}
                    onPress={() => {
                      pick(field);
                    }}
                    style={({ pressed }) => [styles.calendar, pressed && styles.pressed]}
                  >
                    <Feather
                      name="calendar"
                      size={20}
                      color={colors.primaryDeep}
                      accessible={false}
                    />
                  </Pressable>
                }
              />
            </View>
          ))}
        </View>
      )}
      {error && (
        <Txt accessibilityLiveRegion="polite" style={styles.error}>
          {t(error)}
        </Txt>
      )}
      {pickerError && (
        <Txt accessibilityLiveRegion="polite" style={styles.error}>
          {t('visitPeriodPickerError')}
        </Txt>
      )}
      {onReset && period && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (pending.current) return;
            Keyboard.dismiss();
            setPickerError(false);
            onReset();
          }}
          style={styles.reset}
        >
          <Txt style={styles.resetText}>{t('resetFilters')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filter: { gap: 8 },
  fields: { flexDirection: 'row', gap: 8 },
  stack: { flexDirection: 'column' },
  field: { flex: 1, minWidth: 0 },
  calendar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  reset: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  resetText: { color: colors.primaryDeep, fontSize: 14, fontWeight: '600' },
});
