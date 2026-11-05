import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { useRemote, useWrite } from '../../core/hooks';
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  PageHeader,
  RemoteState,
  Screen,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { AccountSession } from './models';
import { ProfileRepository } from './repository';
import { sessionActivity, sessionDevice } from './session-presentation';

export function SecuritySessionsScreen() {
  const { api, t, locale } = useApp();
  const repo = useMemo(() => new ProfileRepository(api), [api]);
  const remote = useRemote(useCallback(() => repo.sessions(), [repo]));
  const write = useWrite();
  const [confirming, setConfirming] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(Date.now);
  const focused = useIsFocused();
  const confirmation = useRef(false);
  const locked =
    write.busy || confirming || write.uncertain || needsRefresh || remote.loading || !!remote.error;
  useEffect(() => {
    if (!focused) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setNow(Date.now());
    }, 60000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [focused]);
  const sessions = [...(remote.data ?? [])].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (Date.parse(b.lastActiveAt) || 0) - (Date.parse(a.lastActiveAt) || 0),
  );
  const visible = showAll ? sessions : sessions.slice(0, 5);
  const others = sessions.filter((item) => !item.current);
  const currentIdentified = sessions.filter((item) => item.current).length === 1;
  async function reconcile() {
    if (write.busy || confirming) return;
    if (await remote.reload()) {
      write.reset();
      setNeedsRefresh(false);
    }
  }
  async function revoke(session: AccountSession | 'others') {
    if (locked || confirmation.current) return;
    if (session === 'others' && (!currentIdentified || !others.length)) return;
    confirmation.current = true;
    setConfirming(true);
    const accepted = await confirm(
      t(session === 'others' ? 'sessionsOthersQuestion' : 'sessionsRevokeQuestion'),
      t(
        session === 'others'
          ? 'sessionsOthersHint'
          : session.current
            ? 'sessionsCurrentWarning'
            : 'sessionsRevokeHint',
      ),
      t(session === 'others' ? 'sessionsSignOutOthers' : 'sessionsSignOut'),
      t('cancel'),
    );
    confirmation.current = false;
    setConfirming(false);
    if (!accepted) return;
    setNeedsRefresh(true);
    await write.run(
      () =>
        session === 'others' ? repo.revokeOtherSessions(sessions) : repo.revokeSession(session.id),
      async () => {
        if (session !== 'others' && session.current) await api.forgetSession();
        else {
          setNeedsRefresh(true);
          if (await remote.reload()) setNeedsRefresh(false);
        }
      },
    );
  }
  return (
    <Screen>
      <PageHeader
        title={t('sessionsTitle')}
        description={t('sessionsHint')}
        action={
          <IconButton
            label={t('sessionsRefresh')}
            icon="refresh-cw"
            disabled={write.busy || confirming || remote.loading}
            onPress={() => void reconcile()}
          />
        }
      />
      <ErrorBox error={write.error} />
      <ErrorBox error={remote.data ? remote.error : undefined} />
      {(write.uncertain || needsRefresh) && (
        <Txt accessibilityLiveRegion="polite" muted>
          {t('sessionsRefreshRequired')}
        </Txt>
      )}
      {write.busy && (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.primary} />
          <Txt accessibilityLiveRegion="polite">{t('sessionsUpdating')}</Txt>
        </View>
      )}
      <RemoteState
        loading={remote.loading && !remote.data}
        error={remote.data ? undefined : remote.error}
        retry={reconcile}
      >
        {remote.data?.length === 0 && (
          <Card>
            <Txt>{t('sessionsEmpty')}</Txt>
          </Card>
        )}
        {sessions.length > 0 && (
          <Card style={styles.card}>
            {others.length > 0 && currentIdentified && (
              <View style={styles.bulkAction}>
                <Button
                  label={t('sessionsSignOutOthers')}
                  kind="secondary"
                  disabled={locked}
                  onPress={() => void revoke('others')}
                />
              </View>
            )}
            {visible.map((session, index) => {
              const device = sessionDevice(session.userAgent);
              const name = device.name || t('sessionsDeviceFallback');
              const activity = sessionActivity(session.lastActiveAt, locale, now, t);
              const metadata = [
                session.ip ? `${t('sessionsIp')} ${session.ip}` : '',
                activity ? `${t('sessionsActive')} ${activity}` : '',
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View
                  key={session.id}
                  style={[styles.deviceRow, index < visible.length - 1 && styles.divider]}
                >
                  <View style={styles.deviceIcon}>
                    <Feather
                      name={device.mobile ? 'smartphone' : 'monitor'}
                      size={23}
                      color={colors.muted}
                      accessible={false}
                    />
                  </View>
                  <View style={styles.deviceText}>
                    <View style={styles.deviceHeading}>
                      <Txt style={styles.heading}>{name}</Txt>
                      {session.current && (
                        <View style={styles.currentBadge}>
                          <View style={styles.dot} />
                          <Txt style={styles.currentText}>{t('sessionsThisDevice')}</Txt>
                        </View>
                      )}
                    </View>
                    {!!metadata && (
                      <Txt muted style={styles.metadata}>
                        {metadata}
                      </Txt>
                    )}
                  </View>
                  {!session.current && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('sessionsSignOut')}: ${name}${session.ip ? `, ${session.ip}` : ''}`}
                      accessibilityState={{ disabled: locked }}
                      disabled={locked}
                      onPress={() => void revoke(session)}
                      style={({ pressed }) => [
                        styles.signOut,
                        locked && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Txt style={styles.signOutText}>{t('sessionsSignOut')}</Txt>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {sessions.length > 5 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
                onPress={() => setShowAll(!showAll)}
                style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
              >
                <Txt style={styles.showAllText}>
                  {showAll ? t('sessionsShowLess') : `${t('sessionsShowAll')} (${sessions.length})`}
                </Txt>
              </Pressable>
            )}
          </Card>
        )}
      </RemoteState>
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { fontWeight: '700', fontSize: 18, lineHeight: 26, flexShrink: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 0, padding: 16 },
  bulkAction: { alignItems: 'flex-start', paddingBottom: 12 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: { flex: 1, minWidth: 0, gap: 4 },
  deviceHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.pale,
  },
  currentText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  metadata: { fontSize: 16, lineHeight: 24 },
  signOut: {
    minWidth: 48,
    minHeight: 48,
    maxWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  showAll: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  showAllText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.primary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
