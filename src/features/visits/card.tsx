import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { formatInstant } from '../../core/time';
import { Badge, Card, Txt, colors } from '../../core/ui';
import { BookingVisitGroup, Visit } from './models';
// Một thẻ cho mỗi booking trong danh sách (2026-11-09): người được chăm sóc, mã lịch, số buổi, buổi gần nhất; mở trang
// BookingVisits với mọi buổi của booking.
export function BookingGroupCard({ group }: { group: BookingVisitGroup }) {
  const { t, locale } = useApp();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const first = group.visits[0];
  const replacing = group.visits.some((visit) => visit.needsReassignment);
  if (!first) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.name || t('patient')} ${group.bookingCode}, ${t('bookingGroupOpen')}`}
      onPress={() =>
        nav.navigate('BookingVisits', {
          bookingId: group.bookingId,
          code: group.bookingCode,
          name: group.name,
        })
      }
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.content}>
          <View style={styles.heading}>
            <Txt style={styles.name}>{group.name || t('patient')}</Txt>
            <Txt style={styles.details}>
              {t('bookingGroupVisits').replace('{count}', String(group.visits.length))}
            </Txt>
          </View>
          <Txt muted style={styles.infoText}>
            {group.bookingCode}
          </Txt>
          <View style={styles.info}>
            <Feather name="clock" size={15} color={colors.muted} accessible={false} />
            <Txt muted style={styles.infoText}>
              {t('bookingGroupNext').replace('{time}', formatInstant(first.startAt, locale))}
            </Txt>
          </View>
          <View style={styles.badges}>
            <Badge status={first.status} />
            {replacing && <Badge status="withdrawBadge" tone="warning" />}
          </View>
          {first.address ? (
            <View style={styles.info}>
              <Feather name="map-pin" size={16} color={colors.muted} accessible={false} />
              <Txt muted style={styles.infoText}>
                {first.address}
              </Txt>
            </View>
          ) : null}
          <Txt style={styles.details}>{t('bookingGroupOpen')}</Txt>
        </View>
      </Card>
    </Pressable>
  );
}
export function VisitCard({ visit }: { visit: Visit }) {
  const { t, locale } = useApp();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${visit.name} ${formatInstant(visit.startAt, locale)}, ${t('viewDetails')}`}
      onPress={() => nav.navigate('Visit', { id: visit.id })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.content}>
          <View style={styles.heading}>
            <Txt style={styles.name}>{visit.name || t('patient')}</Txt>
            <Txt style={styles.details}>{t('viewDetails')}</Txt>
          </View>
          <View style={styles.info}>
            <Feather name="clock" size={15} color={colors.muted} accessible={false} />
            <Txt muted style={styles.infoText}>
              {formatInstant(visit.startAt, locale)} –{' '}
              {formatInstant(visit.endAt, locale, { hour: '2-digit', minute: '2-digit' })}
            </Txt>
          </View>
          <View style={styles.badges}>
            <Badge status={visit.status} />
            {visit.needsReassignment && <Badge status="withdrawBadge" tone="warning" />}
          </View>
          {visit.address ? (
            <View style={styles.info}>
              <Feather name="map-pin" size={16} color={colors.muted} accessible={false} />
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
  pressed: { opacity: 0.7 },
  card: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 24 },
  accent: { width: 4, borderRadius: 2, backgroundColor: colors.primary },
  content: { flex: 1, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontWeight: '800', fontSize: 18, lineHeight: 25, flex: 1 },
  details: { color: colors.primary, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 21 },
});
