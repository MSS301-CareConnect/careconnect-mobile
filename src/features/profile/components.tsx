import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Card, Txt, colors } from '../../core/ui';

type Icon = React.ComponentProps<typeof Feather>['name'];

export function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: Icon;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.icon}>
          <Feather name={icon} size={24} color={colors.primary} accessible={false} />
        </View>
        <Txt accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Txt>
      </View>
      {children}
    </Card>
  );
}

export function ProfileInfoRow({
  label,
  value,
  onEdit,
  last = false,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  last?: boolean;
}) {
  const { t } = useApp();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const labelWidth = Math.min(100, Math.round(width * 0.22));
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <View style={[styles.infoText, !stacked && styles.infoColumns]}>
        <Txt muted style={[styles.infoLabel, !stacked && { width: labelWidth }]}>
          {label}
        </Txt>
        <Txt style={[styles.infoValue, !stacked && styles.infoValueColumn]}>{value}</Txt>
      </View>
      {onEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profileEditContact')}
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Feather name="edit-3" size={19} color={colors.primary} accessible={false} />
          <Txt style={styles.editText}>{t('profileEdit')}</Txt>
        </Pressable>
      )}
    </View>
  );
}

export function ProfileLink({
  label,
  icon,
  onPress,
  expanded,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Feather name={icon} size={24} color={colors.primary} accessible={false} />
      </View>
      <Txt style={styles.linkLabel}>{label}</Txt>
      <Feather
        name={expanded === undefined ? 'chevron-right' : expanded ? 'chevron-up' : 'chevron-down'}
        size={22}
        color={colors.muted}
        accessible={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '800' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  infoText: { flex: 1, minWidth: 0, gap: 4 },
  infoColumns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoValueColumn: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 16, lineHeight: 24 },
  infoValue: { fontSize: 17, lineHeight: 26, fontWeight: '500' },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  edit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
  },
  editText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  link: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  linkLabel: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
