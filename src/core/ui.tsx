import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { ApiError } from './api';
import { useApp } from './app-context';
export const colors = {
  primary: '#087443',
  ink: '#202D26',
  muted: '#5C6F62',
  bg: '#F8FAF8',
  pale: '#E8F4EC',
  line: '#DFE6DD',
  danger: '#BA1A1A',
  white: '#FFFFFF',
};
export function confirm(title: string, body: string, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      body,
      [
        { text: no, style: 'cancel', onPress: () => resolve(false) },
        { text: yes, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export function Txt({
  children,
  style,
  muted = false,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Text>['style'];
  muted?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[s.text, muted && s.muted, style]}>
      {children}
    </Text>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return <Txt style={s.title}>{children}</Txt>;
}
export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.screen}>
            {children}
          </ScrollView>
        ) : (
          <View style={s.screen}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={s.row}>
        {icon && <Feather name={icon} size={20} color={colors.primary} />}
        <Txt style={s.section}>{title}</Txt>
      </View>
      {children}
    </Card>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  kind = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const foreground =
    kind === 'primary' ? colors.white : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        kind === 'primary' ? s.primary : s.secondary,
        (disabled || loading) && s.disabled,
        pressed && { opacity: 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : icon ? (
        <Feather name={icon} size={18} color={foreground} />
      ) : null}
      <Text style={[s.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Txt style={s.label}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.multiline && s.multiline, props.style]}
      />
    </View>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.chips}>
      {values.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={[s.chip, value === item.value && s.primary]}
        >
          <Txt style={[s.chipText, value === item.value && { color: colors.white }]}>
            {item.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Badge({ status }: { status: string }) {
  const { t } = useApp();
  return (
    <View
      style={[
        s.badge,
        ['CANCELLED', 'MISSED', 'CUSTOMER_NO_SHOW', 'DECLINED'].includes(status) && {
          backgroundColor: '#FDECEA',
        },
      ]}
    >
      {status === 'COMPLETED' && <Feather name="check-circle" size={14} color={colors.primary} />}
      <Txt style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{t(status)}</Txt>
    </View>
  );
}
export function Info({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === '') return null;
  return (
    <View style={s.info}>
      <Txt muted style={{ fontSize: 13 }}>
        {label}
      </Txt>
      <Txt style={{ fontWeight: '500' }}>{value}</Txt>
    </View>
  );
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useApp();
  if (!error) return null;
  let key = 'error';
  if (error instanceof ApiError)
    key = error.uncertain
      ? 'uncertain'
      : error.status === 0
        ? 'network'
        : error.status === 409
          ? 'conflict'
          : [401, 403, 404].includes(error.status)
            ? 'denied'
            : error.status === 400
              ? 'invalid'
              : 'error';
  return (
    <Card style={{ borderColor: '#F3C8C8', backgroundColor: '#FFF8F7' }}>
      <Txt style={{ color: colors.danger }}>
        {t(key)}
        {error instanceof ApiError && error.code !== 0 ? ` (${error.code})` : ''}
      </Txt>
      {retry && <Button kind="secondary" label={t('refresh')} onPress={retry} />}
    </Card>
  );
}
export function RemoteState({
  loading,
  error,
  empty = false,
  retry,
  children,
}: {
  loading: boolean;
  error?: unknown;
  empty?: boolean;
  retry: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useApp();
  if (loading)
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
        <Txt muted>{t('loading')}</Txt>
      </Card>
    );
  if (error) return <ErrorBox error={error} retry={retry} />;
  if (empty)
    return (
      <Card>
        <Feather name="calendar" size={32} color={colors.primary} />
        <Txt style={s.section}>{t('empty')}</Txt>
        <Txt muted>{t('emptyHint')}</Txt>
        <Button kind="secondary" label={t('retry')} onPress={retry} />
      </Card>
    );
  return <>{children}</>;
}
export function Pagination({
  page,
  totalPages,
  totalElements,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onChange: (page: number) => void;
}) {
  const { t } = useApp();
  return (
    <View style={{ gap: 12 }}>
      <Txt muted>
        {t('total')}: {totalElements} · {t('page')} {page + 1}/{Math.max(totalPages, 1)}
      </Txt>
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            kind="secondary"
            label={t('prev')}
            disabled={page === 0}
            onPress={() => onChange(page - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            kind="secondary"
            label={t('next')}
            disabled={page + 1 >= totalPages}
            onPress={() => onChange(page + 1)}
          />
        </View>
      </Row>
    </View>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: 20, gap: 18, paddingBottom: 32 },
  text: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { color: colors.muted },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  section: { fontSize: 17, lineHeight: 25, fontWeight: '700', flexShrink: 1 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.pale, borderWidth: 1, borderColor: '#D9E5D7' },
  disabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#CCD7CA',
    borderRadius: 13,
    padding: 13,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.pale,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.pale,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  info: { gap: 3 },
});
