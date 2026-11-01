import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { useRemote, useWrite } from '../../core/hooks';
import { object, page, required } from '../../core/json';
import { formatInstant } from '../../core/time';
import { Props } from '../../app/routes';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Pagination,
  RemoteState,
  Screen,
  Title,
  Txt,
  colors,
} from '../../core/ui';
import { Notification, NotificationFeed, notificationTarget, parseNotification } from './feed';
const Context = createContext<{ feed: NotificationFeed; revision: number } | null>(null);
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { api } = useApp();
  const [revision, rerender] = useReducer((n) => n + 1, 0);
  const feed = useMemo(() => new NotificationFeed(api, rerender), [api]);
  useEffect(() => {
    void feed.setActive(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', (state) => {
      void feed.setActive(state === 'active');
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
      style={bellStyles.button}
    >
      <Feather name="bell" size={23} color={colors.primary} />
      {!!feed?.unread && (
        <View style={bellStyles.count}>
          <Txt style={{ color: 'white', fontSize: 10, lineHeight: 16 }}>
            {feed.unread > 99 ? '99+' : feed.unread}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}
const bellStyles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
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
});
export function NotificationBanner({ onPress }: { onPress: () => void }) {
  const { t } = useApp();
  const feed = useNotifications();
  if (!feed?.banner) return null;
  return (
    <View style={{ backgroundColor: colors.pale, padding: 12, gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          feed.dismiss();
          onPress();
        }}
      >
        <Txt style={{ fontWeight: '700', color: colors.primary }}>{t('newNotification')}</Txt>
      </Pressable>
      <Button kind="secondary" label={t('close')} onPress={() => feed.dismiss()} />
    </View>
  );
}
export function NotificationsScreen({ navigation }: Props<'Notifications'>) {
  const { api, t, locale } = useApp();
  const feed = useNotifications();
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(
      async () =>
        page(
          await api.request('GET', '/notifications', undefined, { page: p, size: 20 }),
          parseNotification,
        ),
      [api, p],
    ),
  );
  const write = useWrite();
  const reload = remote.reload;
  useEffect(() => {
    if (!write.busy) {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void reload();
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [reload, write.busy]);
  async function reconcile() {
    if (await remote.reload()) write.reset();
  }
  async function open(item: Notification) {
    await write.run(async () => {
      if (!item.readAt) await api.request('PATCH', `/notifications/${item.id}/read`);
      const target = notificationTarget(item);
      await feed?.tick();
      if (!target) {
        await remote.reload();
        return;
      }
      if (target.screen === 'Report') {
        const report = object(await api.request('GET', `/care-reports/${target.id}`));
        navigation.navigate('Report', {
          bookingId: required(report.bookingId),
          sessionId: required(report.sessionId),
        });
      } else navigation.navigate(target.screen, { id: target.id });
    });
  }
  return (
    <Screen>
      <Title>{t('notifications')}</Title>
      <Txt muted>{t('inboxHint')}</Txt>
      <Button
        kind="secondary"
        label={t('readAll')}
        loading={write.busy}
        disabled={write.uncertain}
        onPress={() =>
          void write.run(
            () => api.request('PATCH', '/notifications/read-all'),
            async () => {
              await remote.reload();
              await feed?.tick();
            },
          )
        }
      />
      <ErrorBox error={write.error} retry={reconcile} />
      <RemoteState {...remote} empty={remote.data?.items.length === 0} retry={remote.reload}>
        {remote.data?.items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            disabled={write.busy || write.uncertain}
            onPress={() => void open(item)}
          >
            <Card style={{ backgroundColor: item.readAt ? 'white' : '#EFF5EB' }}>
              <Txt muted style={{ fontSize: 12 }}>
                {formatInstant(item.createdAt, locale)}
              </Txt>
              <Txt style={{ fontWeight: '700' }}>{item.title}</Txt>
              <Txt>{item.body}</Txt>
              {!item.readAt && <Badge status="unread" />}
            </Card>
          </Pressable>
        ))}
      </RemoteState>
      {remote.data && <Pagination {...remote.data} onChange={setPage} />}
    </Screen>
  );
}
