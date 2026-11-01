import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from './app-context';
import { Txt, colors } from './ui';

export function BrandTitle() {
  const { t } = useApp();
  return (
    <View style={styles.brand}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.mark}>
        <Feather name="heart" color={colors.white} size={23} />
        <View style={styles.plus}>
          <Feather name="plus" color={colors.primary} size={10} />
        </View>
      </View>
      <Txt numberOfLines={1} style={styles.name}>
        {t('app')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 13,
    height: 13,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  name: {
    fontSize: 23,
    lineHeight: 31,
    letterSpacing: -0.7,
    fontWeight: '800',
    flexShrink: 1,
  },
});
