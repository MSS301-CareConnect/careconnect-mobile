import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { Txt, colors } from './ui';

export function NavigationRow({
  label,
  description,
  icon,
  onPress,
}: {
  label: string;
  description?: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Feather name={icon} size={20} color={colors.primary} accessible={false} />
      </View>
      <View style={styles.text}>
        <Txt style={styles.label}>{label}</Txt>
        {description ? (
          <Txt muted style={styles.description}>
            {description}
          </Txt>
        ) : null}
      </View>
      <Feather name="chevron-right" size={20} color={colors.muted} accessible={false} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 4 },
  label: { fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.65 },
});
