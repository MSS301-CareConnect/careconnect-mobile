import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useApp } from './app-context';
import { Txt } from './ui';

export function BrandMark({ size = 36 }: { size?: number }) {
  // The supplied 52×57 logo contains a 36×36 mark at (9, 7). Clip its screenshot margin in layout.
  const scale = size / 36;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden' }}
    >
      <Image
        source={require('../../assets/images/careconnect-logo.png')}
        accessible={false}
        style={{
          position: 'absolute',
          width: 52 * scale,
          height: 57 * scale,
          left: -9 * scale,
          top: -7 * scale,
        }}
      />
    </View>
  );
}

export function BrandTitle() {
  const { t } = useApp();
  return (
    <View style={styles.brand}>
      <BrandMark />
      <Txt numberOfLines={1} style={styles.name}>
        {t('app')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  name: {
    fontSize: 23,
    lineHeight: 31,
    letterSpacing: -0.7,
    fontWeight: '800',
    flexShrink: 1,
  },
});
