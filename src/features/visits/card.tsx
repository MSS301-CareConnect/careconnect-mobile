import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { formatInstant } from '../../core/time';
import { Badge, Card, Txt, colors } from '../../core/ui';
import { Visit } from './models';
export function VisitCard({ visit }: { visit: Visit }) {
  const { t, locale } = useApp();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${visit.name} ${formatInstant(visit.startAt, locale)}, ${t('viewDetails')}`}
      onPress={() => nav.navigate('Visit', { id: visit.id })}
    >
      <Card style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.content}>
          <View style={styles.heading}>
            <Txt style={styles.name}>{visit.name || t('patient')}</Txt>
            <Txt style={styles.details}>{t('viewDetails')}</Txt>
          </View>
          <View style={styles.info}>
            <Feather name="clock" size={15} color={colors.muted} />
            <Txt muted style={styles.infoText}>
              {formatInstant(visit.startAt, locale)} –{' '}
              {formatInstant(visit.endAt, locale, { hour: '2-digit', minute: '2-digit' })}
            </Txt>
          </View>
          <Badge status={visit.status} />
          {visit.address ? (
            <View style={styles.info}>
              <Feather name="map-pin" size={16} color={colors.muted} />
              <Txt muted style={styles.infoText}>
                {visit.address}
              </Txt>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 24 },
  accent: { width: 4, borderRadius: 2, backgroundColor: colors.primary },
  content: { flex: 1, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontWeight: '800', fontSize: 18, lineHeight: 25, flex: 1 },
  details: { color: colors.primary, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 21 },
});
