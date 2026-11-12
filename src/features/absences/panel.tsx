import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { Badge, Button, ErrorBox, Pagination, Row, Txt, colors } from '../../core/ui';
import { Absence } from './models';
import { useAbsenceVisitLabel } from './presentation';
import { AbsenceRepository } from './repository';

const BOOKINGS_PER_PAGE = 3;

function groupAbsences(items: Absence[]) {
  const groups = new Map<string, Absence[]>();
  for (const item of items) {
    const group = groups.get(item.bookingId);
    if (group) group.push(item);
    else groups.set(item.bookingId, [item]);
  }
  return [...groups].map(([id, visits]) => ({
    id,
    visits: visits.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    name: visits.find((item) => item.recipientName)?.recipientName,
    code: visits.find((item) => item.bookingCode)?.bookingCode,
    waiting: visits.filter((item) => !item.explanation.trim()).length,
  }));
}

export function AbsencePanel({ refreshKey }: { refreshKey: number }) {
  const { api, t } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const visitLabel = useAbsenceVisitLabel();
  const repo = useMemo(() => new AbsenceRepository(api), [api]);
  const remote = useRemote(useCallback(() => repo.pending(), [repo]));
  const previousRefresh = useRef(refreshKey);
  const { reload } = remote;
  useEffect(() => {
    if (refreshKey === previousRefresh.current) return;
    previousRefresh.current = refreshKey;
    reload();
  }, [refreshKey, reload]);
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const groups = useMemo(() => groupAbsences(remote.data ?? []), [remote.data]);
  const totalPages = Math.ceil(groups.length / BOOKINGS_PER_PAGE);
  const current = Math.min(page, Math.max(0, totalPages - 1));
  if (remote.error) {
    const denied = remote.error instanceof ApiError && [401, 403].includes(remote.error.status);
    return (
      <ErrorBox
        error={remote.error}
        messageKey={denied ? undefined : 'absencePanelError'}
        retry={reload}
      />
    );
  }
  if (!remote.data) {
    return (
      <Txt muted accessibilityLiveRegion="polite">
        {t('absencePanelLoading')}
      </Txt>
    );
  }
  if (!groups.length) return null;

  const heading = t('absencePanelTitle').replace('{count}', String(remote.data.length));
  const waiting = groups.reduce((count, group) => count + group.waiting, 0);
  const summary = t('absencePanelSummary')
    .replace('{bookings}', String(groups.length))
    .replace('{waiting}', String(waiting));
  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={heading}
        accessibilityHint={summary}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.alertIcon}>
          <Feather name="user-x" size={20} color={colors.white} accessible={false} />
        </View>
        <View style={styles.headerText}>
          <Txt style={styles.title}>{heading}</Txt>
          <Txt muted style={styles.meta}>
            {summary}
          </Txt>
        </View>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.muted}
          accessible={false}
        />
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Txt muted style={styles.meta}>
            {t('absencePanelHint')}
          </Txt>
          {groups
            .slice(current * BOOKINGS_PER_PAGE, (current + 1) * BOOKINGS_PER_PAGE)
            .map((group) => {
              const showVisits = expanded === group.id || groups.length === 1;
              const disclosureLabel = t(
                showVisits ? 'absencePanelHideVisits' : 'absencePanelShowVisits',
              );
              return (
                <View key={group.id} style={styles.booking}>
                  <View style={styles.bookingHeading}>
                    <Txt style={styles.title}>{group.name || t('patient')}</Txt>
                    {!!group.code && (
                      <Txt muted style={styles.meta}>
                        {group.code}
                      </Txt>
                    )}
                    <Row>
                      <Txt muted style={styles.meta}>
                        {t('absencePanelCount').replace('{count}', String(group.visits.length))}
                      </Txt>
                      {group.waiting > 0 && (
                        <Txt style={styles.waiting}>
                          {t('absencePanelWaiting').replace('{count}', String(group.waiting))}
                        </Txt>
                      )}
                    </Row>
                    <Row>
                      <Button
                        label={t('absencePanelOpenBooking')}
                        kind="secondary"
                        onPress={() =>
                          navigation.navigate('BookingVisits', {
                            bookingId: group.id,
                            code: group.code,
                            name: group.name,
                          })
                        }
                      />
                      {groups.length > 1 && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={disclosureLabel}
                          accessibilityState={{ expanded: showVisits }}
                          onPress={() => setExpanded(showVisits ? undefined : group.id)}
                          style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
                        >
                          <Txt style={styles.disclosureLabel}>{disclosureLabel}</Txt>
                          <Feather
                            name={showVisits ? 'chevron-up' : 'chevron-down'}
                            size={17}
                            color={colors.primaryDeep}
                            accessible={false}
                          />
                        </Pressable>
                      )}
                    </Row>
                  </View>
                  {showVisits &&
                    group.visits.map((item) => {
                      const explained = !!item.explanation.trim();
                      return (
                        <View key={item.id} style={styles.visit}>
                          <Txt style={styles.title}>{visitLabel(item)}</Txt>
                          <Badge
                            status={explained ? 'absencePanelExplained' : 'absencePanelUnexplained'}
                            tone={explained ? 'info' : 'warning'}
                          />
                          <Txt muted numberOfLines={2} style={styles.meta}>
                            {explained ? item.explanation : t('absenceNoExplanation')}
                          </Txt>
                          <Row>
                            <Button
                              label={t('viewDetails')}
                              kind="secondary"
                              onPress={() =>
                                navigation.navigate('Visit', { id: item.occurrenceId })
                              }
                            />
                            <Button
                              label={t(explained ? 'absenceEditExplanation' : 'absenceExplain')}
                              onPress={() => navigation.navigate('AbsenceExplain', { id: item.id })}
                            />
                          </Row>
                        </View>
                      );
                    })}
                </View>
              );
            })}
          {totalPages > 1 && (
            <Pagination
              page={current}
              totalPages={totalPages}
              totalElements={groups.length}
              onChange={(value) => {
                setPage(value);
                setExpanded(undefined);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4CECB',
    backgroundColor: colors.dangerBg,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderRadius: 16,
  },
  pressed: { opacity: 0.7 },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '700' },
  meta: { fontSize: 14, lineHeight: 20 },
  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  booking: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  bookingHeading: { padding: 12, gap: 4 },
  waiting: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  disclosure: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  disclosureLabel: { color: colors.primaryDeep, fontWeight: '600', flexShrink: 1 },
  visit: { gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line },
});
