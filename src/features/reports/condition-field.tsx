import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Txt, colors } from '../../core/ui';
import { conditions } from './models';

export function ConditionField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const expanded = open && !disabled;
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <View style={styles.field}>
      <Txt style={styles.label}>{t('overallCondition')}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('overallCondition')}
        accessibilityValue={{ text: t(value || 'chooseCondition') }}
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={() => {
          if (!expanded) Keyboard.dismiss();
          setOpen(!expanded);
        }}
        style={({ pressed }) => [
          styles.input,
          expanded && styles.expanded,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Txt muted={!value} style={styles.value}>
          {t(value || 'chooseCondition')}
        </Txt>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.muted}
          accessible={false}
        />
      </Pressable>
      {expanded && (
        <View style={styles.options}>
          {conditions.map((condition) => {
            const selected = value === condition;
            return (
              <Pressable
                key={condition}
                accessibilityRole="radio"
                accessibilityLabel={t(condition)}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  onChange(condition);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Txt style={styles.value}>{t(condition)}</Txt>
                {selected && (
                  <Feather name="check" size={20} color={colors.primary} accessible={false} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  input: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  expanded: { borderColor: colors.primary },
  value: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  options: {
    padding: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selected: { backgroundColor: colors.pale },
});
