import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Txt, colors } from '../../core/ui';

export function CareBanner() {
  const { t } = useApp();
  const [width, setWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const height = Math.max(152, Math.min(184, width / 2.8), Math.ceil(contentHeight + 36));
  return (
    <View
      style={[styles.banner, { height }]}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Image
          source={require('../../../assets/images/home-care-banner.png')}
          style={[styles.image, { width, height }]}
          accessible={false}
          resizeMode="cover"
        />
      )}
      <View
        style={styles.content}
        onLayout={({ nativeEvent }) => setContentHeight(nativeEvent.layout.height)}
      >
        <Txt style={styles.tagline}>
          {t('homeBannerFirst')}
          {'\n'}
          {t('homeBannerSecond')}
        </Txt>
        <View style={styles.decoration} importantForAccessibility="no-hide-descendants">
          <Feather name="heart" size={20} color={colors.pale} />
          <View style={styles.flourish} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    flexShrink: 0,
    padding: 18,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  content: { maxWidth: '52%', gap: 12 },
  image: { position: 'absolute', top: 0, left: 0 },
  tagline: { fontSize: 20, lineHeight: 27, fontWeight: '800', color: colors.white },
  decoration: { flexDirection: 'row', alignItems: 'center' },
  flourish: {
    width: 56,
    height: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.pale,
    borderBottomRightRadius: 24,
    transform: [{ rotate: '-8deg' }],
  },
});
