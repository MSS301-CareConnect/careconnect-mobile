import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../../core/app-context';
import { useRemote, useWrite } from '../../core/hooks';
import { object, required } from '../../core/json';
import { formatInstant } from '../../core/time';
import { Props } from '../../app/routes';
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  Pagination,
  RemoteState,
  Screen,
  Row,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { Notification, NotificationFeed, notificationTarget } from './feed';
import { NotificationRepository, RelatedVisit } from './repository';
const Context = createContext<{ feed: NotificationFeed; revision: number } | null>(null);
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { api } = useApp();
  const [revision, rerender] = useReducer((n) => n + 1, 0);
  const feed = useMemo(() => new NotificationFeed(api, rerender), [api]);
  useEffect(() => {
    feed.setActive(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', (state) => {
      feed.setActive(state === 'active');
    });
    return () => {
      sub.remove();
      feed.dispose();
    };
  }, [feed]);
  return <Context.Provider value={{ feed, revision }}>{children}</Context.Provider>;
}
export function useNotifications() {
  return useContext(Context)?.feed;
}
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { t } = useApp();
  const feed = useNotifications();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('notifications')}${feed?.unread !== undefined ? ' ' + feed.unread : ''}`}
      onPress={onPress}
      style={({ pressed }) => [bellStyles.button, pressed && { opacity: 0.7 }]}
    >
      <Feather name="bell" size={23} color={colors.primary} accessible={false} />
      {!!feed?.unread && (
        <View style={bellStyles.count} importantForAccessibility="no-hide-descendants">
          <Txt style={bellStyles.countText}>{feed.unread > 99 ? '99+' : feed.unread}</Txt>
        </View>
      )}
    </Pressable>
  );
}
const bellStyles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: {
    position: 'absolute',
    right: -3,
    top: -3,
    backgroundColor: colors.danger,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  countText: { color: colors.white, fontSize: 10, lineHeight: 16 },
});
export function NotificationBanner({ onPress }: { onPress: () => void }) {
  const { t } = useApp();
  const feed = useNotifications();
  if (!feed?.banner) return null;
  return (
    <SafeAreaView edges={['top']} style={inboxStyles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('newNotification')}
        style={({ pressed }) => ({
          minHeight: 48,
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
        onPress={() => {
          feed.dismiss();
          onPress();
        }}
      >
        <Txt style={inboxStyles.bannerLabel}>{t('newNotification')}</Txt>
      </Pressable>
      <Button kind="secondary" label={t('close')} onPress={() => feed.dismiss()} />
    </SafeAreaView>
  );
}
export function NotificationsScreen({ navigation }: Props<'Notifications'>) {
  const { api, t, locale } = useApp();
  const feed = useNotifications();
  const repo = useMemo(() => new NotificationRepository(api), [api]);
  const focused = useIsFocused();
  const [p, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [related, setRelated] = useState<RelatedVisit[]>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmation = useRef(false);
  const remote = useRemote(
    useCallback(() => repo.list({ page: p, unreadOnly }), [repo, p, unreadOnly]),
  );
  const write = useWrite();
  const reload = remote.reload;
  const locked =
    write.busy || write.uncertain || confirming || needsRefresh || remote.loading || !!remote.error;
  const items = remote.data?.items ?? [];
  const selectedIds = selected.filter((id) => items.some((item) => item.id === id));
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const selectionLocked = write.busy || confirming || write.uncertain || needsRefresh;
  function togglePage() {
    setSelected(allSelected ? [] : items.map((item) => item.id));
  }
  useEffect(() => {
    if (!remote.data || remote.loading || remote.error) return;
    const lastPage = Math.max(0, remote.data.totalPages - 1);
    if (p > lastPage) {
      setPage(lastPage);
      setSelected([]);
      setRelated(undefined);
    }
  }, [p, remote.data, remote.loading, remote.error]);
  useEffect(() => {
    if (focused && !write.busy && !write.uncertain && !remote.loading && !confirming) {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') reload();
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [reload, focused, write.busy, write.uncertain, remote.loading, confirming]);
  async function reconcile() {
    if (write.busy || confirming) return;
    if (await remote.reload()) {
      write.reset();
      setNeedsRefresh(false);
      setSelected([]);
    }
    await feed?.refresh();
  }
  async function mutate(action: () => Promise<unknown>, destructive?: string) {
    if (locked || confirmation.current) return false;
    if (destructive) {
      confirmation.current = true;
      setConfirming(true);
      const yes = await confirm(destructive, t('notificationDeleteHint'), t('remove'), t('cancel'));
      confirmation.current = false;
      setConfirming(false);
      if (!yes) return false;
    }
    let succeeded = false;
    await write.run(action, async () => {
      succeeded = true;
      setSelected([]);
      setNeedsRefresh(true);
      const fresh = await remote.reload();
      if (fresh) setNeedsRefresh(false);
      await feed?.refresh();
    });
    return succeeded;
  }
  async function open(item: Notification) {
    if (locked) return;
    const target = notificationTarget(item);
    if (!target) return;
    if (!item.readAt && !(await mutate(() => repo.setRead(item.id, true)))) return;
    feed?.dismiss();
    await write.run(async () => {
      if (target.screen === 'BookingRequests') {
        navigation.navigate('BookingRequests', { bookingId: target.bookingId });
      } else if (target.screen === 'BookingVisits') {
        const visits = await repo.bookingVisits(target.bookingId);
        const onlyVisit = visits.length === 1 ? visits[0] : undefined;
        if (onlyVisit) navigation.navigate('Visit', { id: onlyVisit.id });
        else setRelated(visits);
      } else if (target.screen === 'Report') {
        const report = object(await api.request('GET', `/care-reports/${target.id}`));
        navigation.navigate('Report', {
          bookingId: required(report.bookingId),
          sessionId: required(report.sessionId),
        });
      } else if (target.screen === 'Visit') navigation.navigate('Visit', { id: target.id });
      else if (target.screen === 'Session') navigation.navigate('Session', { id: target.id });
    });
  }
  return (
    <Screen contentContainerStyle={inboxStyles.content}>
      <View style={inboxStyles.filterRow}>
        <View style={inboxStyles.segments}>
          {[false, true].map((onlyUnread) => (
            <Pressable
              key={String(onlyUnread)}
              accessibilityRole="tab"
              accessibilityLabel={t(onlyUnread ? 'notificationUnreadOnly' : 'notificationAll')}
              accessibilityState={{
                selected: unreadOnly === onlyUnread,
                disabled: selectionLocked,
              }}
              disabled={selectionLocked}
              onPress={() => {
                setUnreadOnly(onlyUnread);
                setPage(0);
                setSelected([]);
                setRelated(undefined);
              }}
              style={({ pressed }) => [
                inboxStyles.segment,
                unreadOnly === onlyUnread && inboxStyles.activeSegment,
                pressed && inboxStyles.pressed,
                selectionLocked && inboxStyles.disabled,
              ]}
            >
              <Txt
                style={[
                  inboxStyles.segmentLabel,
                  unreadOnly === onlyUnread && inboxStyles.activeSegmentLabel,
                ]}
              >
                {t(onlyUnread ? 'unread' : 'notificationAllShort')}
                {!onlyUnread && !unreadOnly && remote.data ? ` (${remote.data.totalElements})` : ''}
              </Txt>
            </Pressable>
          ))}
        </View>
        <IconButton
          label={t('notificationRefresh')}
          icon="refresh-cw"
          disabled={write.busy || confirming || remote.loading}
          onPress={() => reconcile()}
        />
      </View>
      <View style={inboxStyles.utilityRow}>
        <NotificationAction
          label={t('notificationReadAll')}
          icon="check"
          outlined
          disabled={locked}
          onPress={() => mutate(() => repo.readAll())}
        />
        <IconButton
          label={t('notificationMoreActions')}
          icon="more-horizontal"
          disabled={write.busy || confirming}
          onPress={() => setShowOptions((value) => !value)}
        />
      </View>
      {showOptions && (
        <NotificationAction
          label={t('notificationClearRead')}
          icon="trash-2"
          danger
          disabled={locked}
          onPress={() => mutate(() => repo.clearRead(), t('notificationClearReadQuestion'))}
        />
      )}
      <ErrorBox error={write.error} />
      <ErrorBox error={remote.data ? remote.error : undefined} />
      {write.busy && (
        <Row>
          <ActivityIndicator color={colors.primary} />
          <Txt accessibilityLiveRegion="polite">{t('notificationUpdating')}</Txt>
        </Row>
      )}
      {(write.uncertain || needsRefresh) && (
        <Txt accessibilityLiveRegion="polite" muted>
          {t('notificationRefreshRequired')}
        </Txt>
      )}
      {remote.loading && remote.data && (
        <Txt muted accessibilityLiveRegion="polite">
          {t('loading')}
        </Txt>
      )}
      {related && (
        <Card>
          <Row>
            <Txt accessibilityRole="header" style={inboxStyles.heading}>
              {t('notificationRelatedVisits')}
            </Txt>
            <NotificationAction label={t('close')} onPress={() => setRelated(undefined)} />
          </Row>
          {related.length ? (
            related.map((visit) => (
              <Button
                key={visit.id}
                kind="secondary"
                label={`${formatInstant(visit.startAt, locale)} · ${t(visit.status)}`}
                disabled={locked}
                onPress={() => navigation.navigate('Visit', { id: visit.id })}
              />
            ))
          ) : (
            <Txt muted>{t('notificationNoRelatedVisits')}</Txt>
          )}
        </Card>
      )}
      <RemoteState
        loading={remote.loading && !remote.data}
        error={remote.data ? undefined : remote.error}
        retry={reconcile}
      >
        {remote.data && !items.length && (
          <Card>
            <Txt style={inboxStyles.heading}>{t('notificationEmpty')}</Txt>
            <Txt muted>{t(unreadOnly ? 'notificationNoUnread' : 'notificationEmptyHint')}</Txt>
          </Card>
        )}
        {!!items.length && !selectedIds.length && (
          <View style={inboxStyles.selectRow}>
            <NotificationCheckbox
              label={t('notificationSelectPage')}
              checked={false}
              disabled={locked}
              onPress={togglePage}
            />
            <Txt muted style={inboxStyles.selectLabel}>
              {t('notificationSelectAllVisible')}
            </Txt>
          </View>
        )}
        {!!selectedIds.length && (
          <View style={inboxStyles.selectionBar}>
            <View style={inboxStyles.selectionHeader}>
              <NotificationCheckbox
                label={t('notificationSelectPage')}
                checked={allSelected ? true : 'mixed'}
                disabled={locked}
                onPress={togglePage}
              />
              <Txt style={inboxStyles.selectionCount} accessibilityLiveRegion="polite">
                {t('notificationSelected')} {selectedIds.length}
              </Txt>
              <IconButton
                label={t('notificationClearSelection')}
                icon="x"
                disabled={selectionLocked}
                onPress={() => setSelected([])}
              />
            </View>
            <View style={inboxStyles.batchActions}>
              <NotificationAction
                label={t('notificationMarkRead')}
                icon="check-circle"
                compact
                disabled={locked}
                onPress={() => mutate(() => repo.setReadMany(selectedIds, true))}
              />
              <NotificationAction
                label={t('notificationMarkUnread')}
                icon="mail"
                compact
                disabled={locked}
                onPress={() => mutate(() => repo.setReadMany(selectedIds, false))}
              />
              <NotificationAction
                label={t('notificationSelectedDelete')}
                icon="trash-2"
                danger
                compact
                disabled={locked}
                onPress={() =>
                  mutate(
                    () => repo.removeMany(selectedIds),
                    t('notificationDeleteSelectedQuestion'),
                  )
                }
              />
            </View>
          </View>
        )}
        <View style={inboxStyles.list}>
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);
            const visual = notificationVisual(item.type);
            const target = notificationTarget(item);
            function toggleItem() {
              setSelected(
                checked ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id],
              );
            }
            return (
              <View
                key={item.id}
                style={[
                  inboxStyles.itemCard,
                  checked && inboxStyles.selectedCard,
                  !item.readAt && !checked && inboxStyles.unreadCard,
                ]}
              >
                <NotificationCheckbox
                  label={`${t('notificationSelect')}: ${item.title}`}
                  checked={checked}
                  disabled={locked}
                  onPress={toggleItem}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.body}`}
                  accessibilityHint={t(
                    selectedIds.length || !target ? 'notificationSelect' : 'viewDetails',
                  )}
                  accessibilityState={{ disabled: locked }}
                  disabled={locked}
                  onPress={() => (selectedIds.length || !target ? toggleItem() : open(item))}
                  onLongPress={toggleItem}
                  style={({ pressed }) => [inboxStyles.itemContent, pressed && inboxStyles.pressed]}
                >
                  <View style={[inboxStyles.typeIcon, { backgroundColor: visual.background }]}>
                    <Feather name={visual.icon} size={23} color={visual.color} accessible={false} />
                  </View>
                  <View style={inboxStyles.itemText}>
                    <View style={inboxStyles.itemMetadata}>
                      {!item.readAt && (
                        <View style={inboxStyles.unreadStatus}>
                          <View style={inboxStyles.unreadDot} />
                          <Txt style={inboxStyles.unreadLabel}>{t('unread')}</Txt>
                        </View>
                      )}
                      <Txt muted style={inboxStyles.time}>
                        {formatInstant(item.createdAt, locale, {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                        {' · '}
                        {formatInstant(item.createdAt, locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Txt>
                    </View>
                    <Txt style={inboxStyles.heading}>{item.title}</Txt>
                    {!!item.body && <Txt muted>{item.body}</Txt>}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </RemoteState>
      {remote.data && remote.data.totalPages > 1 && (
        <View
          pointerEvents={locked ? 'none' : 'auto'}
          accessibilityElementsHidden={locked}
          importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        >
          <Pagination
            {...remote.data}
            onChange={(next) => {
              if (!locked) {
                setPage(next);
                setSelected([]);
                setRelated(undefined);
              }
            }}
          />
        </View>
      )}
    </Screen>
  );
}

function NotificationCheckbox({
  label,
  checked,
  disabled,
  onPress,
}: {
  label: string;
  checked: boolean | 'mixed';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        inboxStyles.checkbox,
        pressed && inboxStyles.pressed,
        disabled && inboxStyles.disabled,
      ]}
    >
      <View style={[inboxStyles.checkboxBox, checked !== false && inboxStyles.checkboxChecked]}>
        {checked !== false && (
          <Feather
            name={checked === 'mixed' ? 'minus' : 'check'}
            size={18}
            color={colors.white}
            accessible={false}
          />
        )}
      </View>
    </Pressable>
  );
}

function notificationVisual(type: string): {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  background: string;
} {
  if (['OCCURRENCE_MISSED', 'NO_SHOW_REPORTED', 'NO_SHOW_AUTO_ACCEPTED'].includes(type))
    return { icon: 'user-x', color: colors.danger, background: colors.dangerBg };
  if (
    [
      'BOOKING_CANCELLED',
      'OCCURRENCE_CANCELLED',
      'CAREGIVER_UNASSIGNED',
      'BOOKING_REJECTED',
    ].includes(type)
  )
    return { icon: 'calendar', color: colors.danger, background: colors.dangerBg };
  if (
    [
      'SHIFT_REMINDER',
      'CENTER_ACTION_DUE',
      'BOOKING_EXPIRED',
      'REMAINING_DUE',
      'REMAINING_OVERDUE',
    ].includes(type)
  )
    return { icon: 'clock', color: colors.warning, background: colors.warningBg };
  if (['CAREGIVER_ASSIGNED', 'CAREGIVER_REQUEST'].includes(type))
    return { icon: 'user-check', color: colors.primary, background: colors.pale };
  if (type === 'BOOKING_ADDRESS_CHANGED')
    return { icon: 'map-pin', color: colors.info, background: colors.infoBg };
  if (type === 'REPORT_SUBMITTED')
    return { icon: 'file-text', color: colors.primary, background: colors.pale };
  if (['SESSION_ENDED', 'BOOKING_COMPLETED'].includes(type))
    return { icon: 'check-circle', color: colors.primary, background: colors.pale };
  return { icon: 'bell', color: colors.primary, background: colors.pale };
}

function NotificationAction({
  label,
  accessibilityLabel,
  icon,
  onPress,
  disabled = false,
  danger = false,
  compact = false,
  outlined = false,
}: {
  label: string;
  accessibilityLabel?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
  outlined?: boolean;
}) {
  const foreground = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onPress();
      }}
      style={({ pressed }) => [
        inboxStyles.action,
        {
          backgroundColor: danger ? colors.dangerBg : colors.surfaceMuted,
        },
        compact && inboxStyles.compactAction,
        outlined && inboxStyles.outlinedAction,
        disabled && inboxStyles.disabled,
        pressed && inboxStyles.pressed,
      ]}
    >
      {icon && (
        <Feather name={icon} size={compact ? 23 : 19} color={foreground} accessible={false} />
      )}
      <Txt
        style={[
          inboxStyles.actionLabel,
          compact && inboxStyles.compactLabel,
          { color: foreground },
        ]}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
const inboxStyles = StyleSheet.create({
  banner: { backgroundColor: colors.pale, padding: 16, gap: 8 },
  bannerLabel: { fontWeight: '700', color: colors.primary },
  content: { gap: 12, paddingTop: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  segments: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    backgroundColor: colors.pale,
    padding: 4,
    borderRadius: 28,
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSegment: { backgroundColor: colors.primary },
  segmentLabel: { fontWeight: '700', textAlign: 'center' },
  activeSegmentLabel: { color: colors.white },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectLabel: { flex: 1, fontSize: 14, lineHeight: 22 },
  selectionBar: { backgroundColor: colors.pale, borderRadius: 20, padding: 8, gap: 8 },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionCount: { flex: 1, fontWeight: '700' },
  batchActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  heading: { fontSize: 16, lineHeight: 24, fontWeight: '700', flexShrink: 1 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingVertical: 12,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    elevation: 1,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  selectedCard: { backgroundColor: colors.pale, borderColor: colors.primary, elevation: 0 },
  unreadCard: { borderColor: colors.borderStrong },
  itemContent: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', gap: 10 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  itemText: { flex: 1, minWidth: 0, gap: 4 },
  itemMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  time: { fontSize: 12, lineHeight: 20, flexShrink: 1 },
  unreadStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 'auto' },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  unreadLabel: { fontSize: 12, lineHeight: 20, color: colors.primary, fontWeight: '700' },
  action: {
    minHeight: 48,
    minWidth: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 1,
  },
  compactAction: {
    flexBasis: 88,
    flexGrow: 1,
    flexDirection: 'column',
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  compactLabel: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  outlinedAction: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 24,
  },
  checkbox: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  actionLabel: { fontWeight: '700', flexShrink: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
