import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { Routes } from '../../app/routes';
import { formatInstant } from '../../core/time';
import { useVietnamDay } from '../../core/use-vietnam-day';
import {
  Badge,
  Button,
  Card,
  Chips,
  ErrorBox,
  Field,
  Info,
  IconButton,
  Pagination,
  RemoteState,
  Row,
  Screen,
  Section,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { ProfileRepository } from './repository';
import { canCancelSchedule, ProviderSchedule } from './schedule';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new ProfileRepository(api), [api]);
}
function CertificateFiles({ id }: { id: string }) {
  const { t } = useApp();
  const repo = useRepo();
  const remote = useRemote(useCallback(() => repo.media('CERTIFICATE', id), [repo, id]));
  return (
    <RemoteState {...remote} empty={remote.data?.length === 0} retry={remote.reload}>
      {remote.data?.map((file) => (
        <Button
          key={file.id}
          kind="secondary"
          label={file.name || t('viewFile')}
          disabled={!file.url.startsWith('https://')}
          onPress={() => void Linking.openURL(file.url)}
        />
      ))}
    </RemoteState>
  );
}
export function ProfileScreen() {
  const { user, t, locale, setLocale, logout } = useApp();
  const repo = useRepo();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const [cert, setCert] = useState('');
  const remote = useRemote(
    useCallback(async () => {
      const profile = await repo.profile();
      const [skills, certificates, media] = await Promise.all([
        repo.skills(profile.id),
        repo.certificates(profile.id),
        repo.media('CAREGIVER_PROFILE', profile.id),
      ]);
      return { profile, skills, certificates, media };
    }, [repo]),
  );
  const avatar = remote.data?.media.find((m) => m.url.startsWith('https://'));
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        {avatar ? (
          <Image source={{ uri: avatar.url }} style={{ width: 78, height: 78, borderRadius: 26 }} />
        ) : (
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 26,
              backgroundColor: colors.pale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="user" size={34} color={colors.primary} />
          </View>
        )}
        <Title>{user?.fullName || t('caregiver')}</Title>
        <Txt muted>{user?.email}</Txt>
        <Badge status="caregiver" />
      </View>
      <Button
        kind="secondary"
        label={t('account')}
        icon="user"
        onPress={() => nav.navigate('Account')}
      />
      <RemoteState {...remote} retry={remote.reload}>
        {remote.data && (
          <>
            <Section title={t('professional')} icon="briefcase">
              <Info label={t('center')} value={remote.data.profile.center} />
              <Info label={t('experienceYears')} value={remote.data.profile.experience} />
              <Info label={t('rating')} value={remote.data.profile.rating} />
              <Info label={t('bio')} value={remote.data.profile.bio} />
              <Info label={t('verificationStatus')} value={t(remote.data.profile.verification)} />
              <Info label={t('caregiverStatus')} value={t(remote.data.profile.status)} />
            </Section>
            <Section title={t('skills')} icon="award">
              {remote.data.skills.length ? (
                remote.data.skills.map((skill) => <Txt key={skill.id}>• {skill.name}</Txt>)
              ) : (
                <Txt muted>—</Txt>
              )}
            </Section>
            <Section title={t('certificates')} icon="file-text">
              {remote.data.certificates.length ? (
                remote.data.certificates.map((item) => (
                  <Card key={item.id}>
                    <Txt style={{ fontWeight: '700' }}>{item.name}</Txt>
                    <Txt muted>
                      {[item.issuedBy, item.issuedDate, item.expiryDate]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                    <Badge status={item.status} />
                    <Button
                      kind="secondary"
                      label={t('viewFile')}
                      onPress={() => setCert(cert === item.id ? '' : item.id)}
                    />
                    {cert === item.id && <CertificateFiles id={item.id} />}
                  </Card>
                ))
              ) : (
                <Txt muted>—</Txt>
              )}
            </Section>
          </>
        )}
      </RemoteState>
      <Section title={t('language')} icon="globe">
        <Chips
          values={[
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'en', label: 'English' },
          ]}
          value={locale}
          onChange={(v) => setLocale(v === 'en' ? 'en' : 'vi')}
        />
      </Section>
      <Button
        kind="danger"
        label={t('logout')}
        icon="log-out"
        onPress={() =>
          void confirm(t('logoutQuestion'), '', t('logout'), t('cancel')).then((ok) => {
            if (ok) void logout();
          })
        }
      />
    </Screen>
  );
}
export function AccountScreen() {
  const { api, user, t } = useApp();
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saved, setSaved] = useState(false);
  const write = useWrite();
  const dirty =
    name !== (user?.fullName ?? '') || phone !== (user?.phoneNumber ?? '') || !!(current || next);
  useDirty(dirty, write.busy);
  return (
    <Screen>
      <Title>{t('account')}</Title>
      <Section title={t('account')} icon="user">
        <Info label={t('email')} value={user?.email} />
        <Field
          label={t('fullName')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setSaved(false);
          }}
          maxLength={255}
          editable={!write.busy}
        />
        <Field
          label={t('phoneNumber')}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setSaved(false);
          }}
          keyboardType="phone-pad"
          maxLength={11}
          editable={!write.busy}
        />
        <Button
          label={t('save')}
          loading={write.busy}
          disabled={write.uncertain || !name.trim() || (!!phone && !/^\d{10,11}$/.test(phone))}
          onPress={() =>
            void write.run(
              async () => {
                await api.request('PUT', '/users/me', {
                  fullName: name.trim(),
                  ...(phone ? { phoneNumber: phone } : {}),
                });
                await api.reloadUser();
              },
              () => setSaved(true),
            )
          }
        />
      </Section>
      <Section title={t('changePassword')} icon="lock">
        <Field
          label={t('currentPassword')}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
          editable={!write.busy}
        />
        <Field
          label={t('newPassword')}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          editable={!write.busy}
        />
        <Txt muted>{t('passwordHint')}</Txt>
        <Button
          label={t('changePassword')}
          loading={write.busy}
          disabled={write.uncertain || !current || next.length < 8}
          onPress={() =>
            void write.run(
              () =>
                api.request('POST', '/users/me/change-password', {
                  currentPassword: current,
                  newPassword: next,
                }),
              () => {
                setCurrent('');
                setNext('');
                setSaved(true);
              },
            )
          }
        />
      </Section>
      <ErrorBox error={write.error} retry={() => void api.reloadUser().then(() => write.reset())} />
      {saved && <Txt>{t('saved')}</Txt>}
    </Screen>
  );
}
function CancelScheduleButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
}) {
  const foreground = primary ? colors.white : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: 12,
        backgroundColor: primary ? colors.danger : colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Feather name="x-circle" size={17} color={foreground} />
      )}
      <Txt style={{ color: foreground, fontWeight: '700', flexShrink: 1 }}>{label}</Txt>
    </Pressable>
  );
}
function ScheduleWriteError({ error }: { error: unknown }) {
  const { t } = useApp();
  const key =
    error instanceof ApiError
      ? error.code === 4415
        ? 'cancelScheduleBooked'
        : error.code === 4404
          ? 'conflict'
          : error.code === 4402
            ? 'cancelScheduleStateChanged'
            : error.code === 4403
              ? 'cancelScheduleReasonRequired'
              : undefined
      : undefined;
  return key ? <Txt style={{ color: colors.danger }}>{t(key)}</Txt> : <ErrorBox error={error} />;
}
export function ProviderScheduleScreen() {
  const { t, locale } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const day = useVietnamDay();
  const load = useCallback(() => repo.schedules(p), [repo, p]);
  const remote = useRemote(load);
  const reload = remote.reload;
  const write = useWrite();
  const [selected, setSelected] = useState<ProviderSchedule>();
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, ProviderSchedule>>({});
  const lastAttempt = useRef<string>(undefined);
  const closing = useRef(false);
  const previousDay = useRef(day);
  const [now, setNow] = useState(Date.now);
  useDirty(!!selected && reason.length > 0, write.busy);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousDay.current !== day) {
      previousDay.current = day;
      void reload();
    }
  }, [day, reload]);
  useEffect(() => {
    // Keep the parsed mutation result visible until a matching or newer GET arrives.
    setConfirmed((current) => {
      const next = { ...current };
      let changed = false;
      remote.data?.items.forEach((item) => {
        const previous = next[item.id];
        if (
          previous &&
          (item.version > previous.version ||
            (item.version === previous.version && item.status === previous.status))
        ) {
          delete next[item.id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [remote.data]);
  function latest(item: ProviderSchedule) {
    const result = confirmed[item.id];
    return result && result.version >= item.version ? result : item;
  }
  const current = remote.data?.items.find((item) => item.id === selected?.id);
  const schedule = current ? latest(current) : undefined;
  const locked = write.busy || write.uncertain || remote.loading || !!remote.error;
  const valid =
    !!schedule && canCancelSchedule(schedule, now) && !!reason.trim() && reason.length <= 500;
  async function reconcile() {
    if (write.busy) return;
    const fresh = await remote.reload();
    if (
      fresh &&
      (!lastAttempt.current || fresh.items.some((item) => item.id === lastAttempt.current))
    )
      write.reset();
  }
  async function close() {
    if (write.busy || closing.current) return;
    closing.current = true;
    try {
      if (
        reason.length > 0 &&
        !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel')))
      )
        return;
      setSelected(undefined);
      setReason('');
    } finally {
      closing.current = false;
    }
  }
  function cancelSelected() {
    if (locked || !valid || !schedule) return;
    if (!canCancelSchedule(schedule)) {
      setNow(Date.now());
      return;
    }
    lastAttempt.current = schedule.id;
    void write.run(
      () => repo.cancelSchedule(schedule, reason),
      async (result) => {
        setConfirmed((items) => ({ ...items, [result.id]: result }));
        setSelected(undefined);
        setReason('');
        setSaved(true);
        await remote.reload();
      },
    );
  }
  function dateLabel(item: ProviderSchedule) {
    return formatInstant(`${item.date}T00:00:00+07:00`, locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }
  return (
    <>
      <View
        style={{ flex: 1 }}
        pointerEvents={selected ? 'none' : 'auto'}
        importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
      >
        <Screen>
          <Row>
            <View style={{ flex: 1 }}>
              <Title>{t('providerSchedule')}</Title>
            </View>
            <IconButton
              label={t('refresh')}
              icon="refresh-cw"
              disabled={remote.loading || write.busy}
              onPress={() => void reconcile()}
            />
          </Row>
          <Txt muted>{t('providerHint')}</Txt>
          {saved && <Txt>{t('cancelScheduleSuccess')}</Txt>}
          {!selected && <ScheduleWriteError error={write.error} />}
          {remote.data && <ErrorBox error={remote.error} />}
          {remote.loading && remote.data && <Txt muted>{t('loading')}</Txt>}
          <RemoteState
            loading={remote.loading && !remote.data}
            error={remote.data ? undefined : remote.error}
            empty={remote.data?.items.length === 0}
            retry={reconcile}
          >
            {remote.data?.items.map((loaded) => {
              const item = latest(loaded);
              return (
                <Card key={item.id} style={{ gap: 9, padding: 16 }}>
                  <Txt style={{ fontWeight: '700', color: colors.primary }}>{dateLabel(item)}</Txt>
                  <Row>
                    <Feather name="clock" size={20} color={colors.primary} />
                    <Txt style={{ fontSize: 24, lineHeight: 31, fontWeight: '800' }}>
                      {item.start.slice(0, 5)}–{item.end.slice(0, 5)}
                    </Txt>
                  </Row>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Badge
                        status={item.status === 'SCHEDULED' ? 'provider_SCHEDULED' : item.status}
                      />
                    </View>
                    {canCancelSchedule(item, now) && (
                      <CancelScheduleButton
                        label={t('cancelSchedule')}
                        disabled={write.busy || remote.loading || !!remote.error}
                        onPress={() => {
                          if (!canCancelSchedule(item)) {
                            setNow(Date.now());
                            return;
                          }
                          setSaved(false);
                          setReason('');
                          setSelected(item);
                        }}
                      />
                    )}
                  </Row>
                  {!!item.note && <Txt muted>{item.note}</Txt>}
                  {item.status === 'CANCELLED' && !!item.cancellationReason && (
                    <Info label={t('cancelScheduleReason')} value={item.cancellationReason} />
                  )}
                </Card>
              );
            })}
          </RemoteState>
          {remote.data && remote.data.totalPages > 1 && (
            <Pagination
              {...remote.data}
              onChange={(page) => {
                if (!selected && !write.busy) setPage(page);
              }}
            />
          )}
        </Screen>
      </View>
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => void close()}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#00000066' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
            >
              <View accessibilityViewIsModal>
                <Card style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 }}>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontSize: 20, lineHeight: 28, fontWeight: '800' }}>
                        {t('cancelSchedule')}
                      </Txt>
                    </View>
                    <IconButton
                      label={t('close')}
                      icon="x"
                      disabled={write.busy}
                      onPress={() => void close()}
                    />
                  </Row>
                  {selected && (
                    <Txt style={{ fontWeight: '700' }}>
                      {dateLabel(schedule ?? selected)} · {(schedule ?? selected).start.slice(0, 5)}
                      –{(schedule ?? selected).end.slice(0, 5)}
                    </Txt>
                  )}
                  <Txt muted>{t('cancelScheduleHint')}</Txt>
                  {!remote.loading && !schedule && (
                    <Txt style={{ color: colors.danger }}>{t('cancelScheduleMissing')}</Txt>
                  )}
                  {schedule?.status === 'CANCELLED' && (
                    <>
                      <Badge status="CANCELLED" />
                      <Txt>{t('cancelScheduleAlreadyCancelled')}</Txt>
                      <Info label={t('cancelScheduleReason')} value={schedule.cancellationReason} />
                    </>
                  )}
                  {schedule &&
                    schedule.status !== 'CANCELLED' &&
                    !canCancelSchedule(schedule, now) && (
                      <Txt>{t('cancelScheduleStateChanged')}</Txt>
                    )}
                  <Field
                    label={t('cancelScheduleReason')}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={500}
                    editable={!write.busy && schedule?.status !== 'CANCELLED'}
                  />
                  <Txt muted>{t('cancelScheduleReasonLimit')}</Txt>
                  <ScheduleWriteError error={write.error} />
                  <ErrorBox error={remote.error} />
                  {(!!write.error || !!remote.error || !schedule) && (
                    <Button
                      label={t('refresh')}
                      kind="secondary"
                      loading={remote.loading}
                      disabled={write.busy}
                      onPress={() => void reconcile()}
                    />
                  )}
                  {schedule?.status !== 'CANCELLED' && (
                    <CancelScheduleButton
                      label={t('cancelScheduleConfirm')}
                      primary
                      busy={write.busy}
                      disabled={locked || !valid}
                      onPress={cancelSelected}
                    />
                  )}
                  <Button
                    label={t('cancelScheduleKeep')}
                    kind="secondary"
                    disabled={write.busy}
                    onPress={() => void close()}
                  />
                </Card>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
