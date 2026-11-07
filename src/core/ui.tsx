import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  useWindowDimensions,
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
  surface: '#FFFFFF',
  surfaceMuted: '#F0F5F1',
  borderStrong: '#7C9383',
  dangerBg: '#FFF0EF',
  warning: '#8A5100',
  warningBg: '#FFF3D6',
  info: '#155D8A',
  infoBg: '#EAF3FA',
  neutral: '#52625A',
  neutralBg: '#EEF1EF',
  scrim: '#12271C80',
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
  ...props
}: TextProps & {
  muted?: boolean;
}) {
  return (
    <Text {...props} numberOfLines={numberOfLines} style={[s.text, muted && s.muted, style]}>
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
        minWidth: 48,
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={20} color={colors.primary} accessible={false} />
    </Pressable>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Txt accessibilityRole="header" style={s.title}>
      {children}
    </Txt>
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.pageHeader}>
      {eyebrow ? <Txt style={s.eyebrow}>{eyebrow}</Txt> : null}
      <View style={s.headingRow}>
        <View style={s.headingText}>
          <Title>{title}</Title>
        </View>
        {action}
      </View>
      {description ? <Txt muted>{description}</Txt> : null}
    </View>
  );
}
export function Screen({
  children,
  scroll = true,
  topInset = false,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const contentStyle = [
    s.screen,
    { paddingHorizontal: width >= 600 ? 24 : 16 },
    contentContainerStyle,
  ];
  return (
    <SafeAreaView
      style={s.safe}
      edges={topInset ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle}>
            {children}
          </ScrollView>
        ) : (
          <View style={contentStyle}>{children}</View>
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
  accessibilityLabel = label,
  style,
  onPress,
  disabled = false,
  loading = false,
  kind = 'primary',
  icon,
}: {
  label: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
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
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        kind === 'primary' ? s.primary : kind === 'danger' ? s.dangerButton : s.secondary,
        style,
        (disabled || loading) && s.disabled,
        pressed && { opacity: 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : icon ? (
        <Feather name={icon} size={18} color={foreground} accessible={false} />
      ) : null}
      <Text style={[s.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  hint,
  error,
  trailing,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string; trailing?: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Txt style={s.label}>{label}</Txt>
      <View style={trailing ? [s.inputRow, error ? s.invalidInput : undefined] : undefined}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          placeholderTextColor={colors.muted}
          {...props}
          style={[
            s.input,
            props.multiline && s.multiline,
            error && !trailing ? s.invalidInput : undefined,
            trailing ? s.growInput : undefined,
            props.style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <Txt accessibilityLiveRegion="polite" style={s.fieldError}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt muted style={s.fieldHint}>
          {hint}
        </Txt>
      ) : null}
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
export type BadgeTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';
function badgeTone(status: string): BadgeTone {
  const value = status.replace(/^(registration|workShift|provider)_/, '');
  if (
    ['REJECTED', 'MISSED', 'CAREGIVER_MISSED', 'CUSTOMER_NO_SHOW', 'DECLINED', 'EXPIRED'].includes(
      value,
    )
  )
    return 'danger';
  if (
    [
      'PENDING',
      'PENDING_CAREGIVER_CONFIRMATION',
      'PENDING_CAREGIVER_ASSIGNMENT',
      'AWAITING_INITIAL_PAYMENT',
      'NEEDS_ATTENTION',
    ].includes(value)
  )
    return 'warning';
  if (['SCHEDULED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'OPEN'].includes(value)) return 'info';
  if (
    [
      'APPROVED',
      'VERIFIED',
      'ACTIVE',
      'DONE',
      'COMPLETED',
      'ENDED',
      'SUBMITTED',
      'STABLE',
      'IMPROVED',
    ].includes(value)
  )
    return 'success';
  return 'neutral';
}
const badgePalettes = {
  success: { backgroundColor: colors.pale, color: colors.primary },
  warning: { backgroundColor: colors.warningBg, color: colors.warning },
  info: { backgroundColor: colors.infoBg, color: colors.info },
  danger: { backgroundColor: colors.dangerBg, color: colors.danger },
  neutral: { backgroundColor: colors.neutralBg, color: colors.neutral },
};
export function Badge({ status, tone }: { status: string; tone?: BadgeTone }) {
  const { t } = useApp();
  const palette = badgePalettes[tone ?? badgeTone(status)];
  return (
    <View style={[s.badge, { backgroundColor: palette.backgroundColor }]}>
      {status === 'COMPLETED' && (
        <Feather name="check-circle" size={14} color={palette.color} accessible={false} />
      )}
      <Txt style={[s.badgeText, { color: palette.color }]}>{t(status)}</Txt>
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
export function ErrorBox({
  error,
  retry,
  messageKey,
}: {
  error: unknown;
  retry?: () => void;
  messageKey?: string;
}) {
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
  if (messageKey && !(error instanceof ApiError && error.uncertain)) key = messageKey;
  return (
    <Card style={{ borderColor: '#F3C8C8', backgroundColor: '#FFF8F7' }}>
      <Txt
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{ color: colors.danger }}
      >
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
  screen: {
    paddingVertical: 20,
    gap: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { color: colors.muted },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  pageHeader: { gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingText: { flex: 1 },
  eyebrow: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.primary },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.pale, borderWidth: 1, borderColor: '#D9E5D7' },
  dangerButton: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  disabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 13,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  invalidInput: { borderColor: colors.danger, borderWidth: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 13,
    backgroundColor: colors.white,
    paddingRight: 4,
  },
  growInput: { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent' },
  fieldHint: { fontSize: 13, lineHeight: 20 },
  fieldError: { fontSize: 13, lineHeight: 20, color: colors.danger },
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
    gap: 4,
  },
  badgeText: { fontSize: 13, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  info: { gap: 3 },
});
