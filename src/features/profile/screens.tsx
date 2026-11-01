import React, { useCallback, useMemo, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { Routes } from '../../app/routes';
import { formatInstant } from '../../core/time';
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
import { canCancelSchedule } from './schedule';
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
function CancelScheduleForm({
  scheduleId,
  onDone,
  onKeep,
}: {
  scheduleId: string;
  onDone: () => void;
  onKeep: () => void;
}) {
  const { t } = useApp();
  const repo = useRepo();
  const write = useWrite();
  const remote = useRemote(
    useCallback(async () => {
      const page = await repo.schedules(0);
      return page.items.find((s) => s.id === scheduleId);
    }, [repo, scheduleId]),
  );
  const [reason, setReason] = useState('');
  const dirty = reason.trim().length > 0;
  useDirty(dirty, write.busy);
  const schedule = remote.data;
  const locked = write.busy || write.uncertain || remote.loading;
  const errorKey =
    write.error instanceof ApiError && write.error.status === 409
      ? 'cancelScheduleBooked'
      : undefined;
  async function reconcile() {
    const fresh = await remote.reload();
    if (fresh) write.reset();
  }
  return (
    <Card style={{ gap: 10, padding: 16, borderWidth: 1, borderColor: colors.line }}>
      <Txt style={{ fontWeight: '700' }}>{t('cancelScheduleQuestion')}</Txt>
      <Txt muted>{t('cancelScheduleHint')}</Txt>
      <Field
        label={t('cancelScheduleReason')}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        editable={!locked}
      />
      <Txt muted>{t('cancelScheduleReasonLimit')}</Txt>
      {errorKey && <Txt muted>{t(errorKey)}</Txt>}
      <ErrorBox error={write.uncertain ? undefined : write.error} retry={reconcile} />
      {write.uncertain && (
        <Button
          label={t('refresh')}
          kind="secondary"
          disabled={remote.loading}
          onPress={() => void reconcile()}
        />
      )}
      {!write.uncertain && (
        <>
          <Button
            label={t('cancelScheduleConfirm')}
            kind="danger"
            disabled={locked || !reason.trim() || reason.length > 500 || !schedule}
            loading={write.busy}
            onPress={() => {
              if (!schedule) return;
              void write.run(
                () => repo.cancelSchedule(schedule, reason),
                async () => {
                  onDone();
                },
              );
            }}
          />
          <Button
            label={t('cancelScheduleKeep')}
            kind="secondary"
            disabled={write.busy}
            onPress={onKeep}
          />
        </>
      )}
    </Card>
  );
}
export function ProviderScheduleScreen() {
  const { t, locale } = useApp();
  const repo = useRepo();
  const [p, setPage] = useState(0);
  const remote = useRemote(useCallback(() => repo.schedules(p), [repo, p]));
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const now = Date.now();
  return (
    <Screen>
      <Row>
        <View style={{ flex: 1 }}>
          <Title>{t('providerSchedule')}</Title>
        </View>
        <IconButton
          label={t('refresh')}
          icon="refresh-cw"
          disabled={remote.loading}
          onPress={() => void remote.reload()}
        />
      </Row>
      <Txt muted>{t('providerHint')}</Txt>
      {notice !== '' && <Txt>{t(notice)}</Txt>}
      <RemoteState {...remote} empty={remote.data?.items.length === 0} retry={remote.reload}>
        {remote.data?.items.map((item) => {
          const canCancel = canCancelSchedule(item, now);
          const isCancelling = cancellingId === item.id;
          return (
            <Card key={item.id} style={{ gap: 9, padding: 16 }}>
              <Txt style={{ fontWeight: '700', color: colors.primary }}>
                {formatInstant(`${item.date}T00:00:00+07:00`, locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}
              </Txt>
              <Txt style={{ fontSize: 24, lineHeight: 31, fontWeight: '800' }}>
                {item.start.slice(0, 5)}–{item.end.slice(0, 5)}
              </Txt>
              <Badge status={item.status} />
              {item.note ? <Txt muted>{item.note}</Txt> : null}
              {canCancel && !isCancelling && (
                <Button
                  label={t('cancelSchedule')}
                  kind="danger"
                  onPress={() => {
                    setNotice('');
                    setCancellingId(item.id);
                  }}
                />
              )}
              {isCancelling && (
                <CancelScheduleForm
                  scheduleId={item.id}
                  onDone={() => {
                    setCancellingId(null);
                    setNotice('cancelScheduleSuccess');
                    void remote.reload();
                  }}
                  onKeep={() => setCancellingId(null)}
                />
              )}
            </Card>
          );
        })}
      </RemoteState>
      {remote.data && remote.data.totalPages > 1 && (
        <Pagination {...remote.data} onChange={setPage} />
      )}
    </Screen>
  );
}
