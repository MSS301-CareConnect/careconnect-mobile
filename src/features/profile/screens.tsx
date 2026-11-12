import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { Routes } from '../../app/routes';
import { formatInstant } from '../../core/time';
import { useVietnamDay } from '../../core/use-vietnam-day';
import { isStrongPassword } from '../../core/validation';
import { pickDocuments, PickedDocument } from '../../core/documents';
import { newestAvatar, ProfileMedia, validateProfileFile } from './models';
import {
  Badge,
  Button,
  Card,
  Chips,
  ErrorBox,
  Field,
  Info,
  IconButton,
  PageHeader,
  RemoteState,
  Screen,
  Section,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { ProfileRepository } from './repository';
import { ProfileInfoRow, ProfileLink, ProfileSection } from './components';
function useRepo() {
  const { api } = useApp();
  return useMemo(() => new ProfileRepository(api), [api]);
}
export function ProfileScreen() {
  const { user, t, locale, setLocale, logout } = useApp();
  const repo = useRepo();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const [file, setFile] = useState<PickedDocument>();
  const [fileError, setFileError] = useState(false);
  const [uploadUnknown, setUploadUnknown] = useState(false);
  const [mediaOverride, setMediaOverride] = useState<ProfileMedia[]>([]);
  const [imageErrorUri, setImageErrorUri] = useState('');
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const day = useVietnamDay();
  const avatarWrite = useWrite();
  useDirty(!!file, avatarWrite.busy);
  const remote = useRemote(
    useCallback(async () => {
      const profile = await repo.profile();
      const [skills, media, certificates] = await Promise.all([
        repo.skills(profile.id),
        repo.media('CAREGIVER_PROFILE', profile.id),
        repo.certificates(profile.id).then(
          (items) => ({ items, error: undefined }),
          (error: unknown) => ({ items: undefined, error }),
        ),
      ]);
      return { profile, skills, media, certificates };
    }, [repo]),
  );
  const avatar = newestAvatar([...(remote.data?.media ?? []), ...mediaOverride]);
  const actualName = remote.data?.profile.fullName || user?.fullName;
  const nameParts = actualName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = [
    nameParts[0]?.[0],
    nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] : '',
  ]
    .join('')
    .toUpperCase();
  const imageUri = file?.uri ?? avatar?.url;
  const avatarLocked =
    !remote.data || remote.loading || avatarWrite.busy || avatarWrite.uncertain || uploadUnknown;
  const profile = remote.data?.profile;
  const checks = remote.data?.certificates.items
    ? [
        { label: 'profileMissingPhoto', done: !!avatar },
        { label: 'profileMissingPhone', done: !!user?.phoneNumber },
        { label: 'profileMissingBirth', done: !!profile?.dateOfBirth },
        { label: 'profileMissingBio', done: !!profile?.bio.trim() },
        { label: 'profileMissingServices', done: remote.data.skills.length > 0 },
        {
          label: 'profileMissingCertificate',
          done: remote.data.certificates.items.some(
            (item) => item.status !== 'REJECTED' && (!item.expiryDate || item.expiryDate >= day),
          ),
        },
      ]
    : undefined;
  const complete = checks?.filter((item) => item.done).length ?? 0;
  const percent = checks ? Math.round((complete / checks.length) * 100) : 0;
  async function chooseAvatar() {
    if (avatarWrite.busy || avatarWrite.uncertain || uploadUnknown || !remote.data) return;
    setFileError(false);
    try {
      const selection = await pickDocuments({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        multiple: false,
      });
      if (selection.canceled) return;
      const selected = selection.assets[0];
      if (!selected) return;
      validateProfileFile(selected, 'avatar');
      setFile(selected);
      setImageErrorUri('');
    } catch {
      setFileError(true);
    }
  }
  async function reconcileAvatar() {
    if (avatarWrite.busy) return;
    if (await remote.reload()) avatarWrite.reset();
  }
  function uploadAvatar() {
    if (!file || !remote.data || avatarWrite.busy || avatarWrite.uncertain || uploadUnknown) return;
    const caregiverId = remote.data.profile.id;
    void avatarWrite.run(
      async () => {
        try {
          return await repo.uploadMedia('CAREGIVER_PROFILE', caregiverId, file);
        } catch (error) {
          if (error instanceof Error && 'uncertain' in error && error.uncertain)
            setUploadUnknown(true);
          throw error;
        }
      },
      async (result) => {
        setMediaOverride(result);
        setFile(undefined);
        await remote.reload();
      },
    );
  }
  return (
    <Screen>
      <PageHeader
        title={t('profile')}
        description={t('profilePageHint')}
        action={
          <IconButton
            label={t('refresh')}
            icon="refresh-cw"
            disabled={remote.loading || avatarWrite.busy}
            onPress={() => void reconcileAvatar()}
          />
        }
      />
      <Card style={profileStyles.card}>
        <View style={profileStyles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shellAvatarChoose')}
            accessibilityHint={t('shellAvatarHint')}
            accessibilityState={{ disabled: avatarLocked, busy: avatarWrite.busy }}
            disabled={avatarLocked}
            onPress={() => void chooseAvatar()}
            style={({ pressed }) => [
              profileStyles.avatarButton,
              pressed && profileStyles.pressed,
              avatarLocked && profileStyles.disabled,
            ]}
          >
            {imageUri && imageUri !== imageErrorUri ? (
              <Image
                source={{ uri: imageUri }}
                style={profileStyles.avatarImage}
                onError={() => setImageErrorUri(imageUri)}
                accessible={false}
              />
            ) : (
              <View style={profileStyles.avatarFallback}>
                {initials ? (
                  <Txt style={profileStyles.initials}>{initials}</Txt>
                ) : (
                  <Feather name="user" size={34} color={colors.primary} accessible={false} />
                )}
              </View>
            )}
            <View style={profileStyles.camera}>
              <Feather name="camera" size={19} color={colors.white} accessible={false} />
            </View>
          </Pressable>
          <View style={profileStyles.identityText}>
            {!!profile?.verification && (
              <Badge
                status={
                  ['VERIFIED', 'PENDING', 'REJECTED'].includes(profile.verification)
                    ? `profileVerification_${profile.verification}`
                    : profile.verification
                }
                tone={
                  profile.verification === 'VERIFIED'
                    ? 'success'
                    : profile.verification === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                }
              />
            )}
            <Txt accessibilityRole="header" style={profileStyles.name}>
              {actualName || t('caregiver')}
            </Txt>
            <Txt muted style={profileStyles.body}>
              {[t('caregiver'), profile?.center].filter(Boolean).join(' · ')}
            </Txt>
            {!!profile?.status && profile.status !== 'ACTIVE' && <Badge status={profile.status} />}
          </View>
        </View>
        {checks && (
          <View style={profileStyles.completeness}>
            <View style={profileStyles.progressHeading}>
              <Txt style={profileStyles.progressLabel}>
                {t('profileCompleteness')} {percent}%
              </Txt>
              <Txt muted style={profileStyles.body}>
                {complete}/{checks.length}
              </Txt>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('profileCompleteness')}
              accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
              style={profileStyles.progressTrack}
            >
              <View style={[profileStyles.progressFill, { width: `${percent}%` }]} />
            </View>
            {checks.some((item) => !item.done) && (
              <Txt muted style={profileStyles.body}>
                {t('profileMissing')}:{' '}
                {checks
                  .filter((item) => !item.done)
                  .map((item) => t(item.label))
                  .join(' · ')}
              </Txt>
            )}
          </View>
        )}
        {!!remote.data?.certificates.error && (
          <>
            <Txt muted>{t('profileCompletenessUnavailable')}</Txt>
            <ErrorBox error={remote.data.certificates.error} retry={remote.reload} />
          </>
        )}
      </Card>
      {!!(file || fileError || avatarWrite.error) && (
        <Card>
          <Txt muted>{t('shellAvatarHint')}</Txt>
          {file && <Txt>{file.name}</Txt>}
          {fileError && <Txt style={profileStyles.error}>{t('shellAvatarInvalid')}</Txt>}
          {uploadUnknown && <Txt style={profileStyles.error}>{t('shellAvatarUnknown')}</Txt>}
          <ErrorBox error={avatarWrite.error} retry={() => void reconcileAvatar()} />
          {file && (
            <Button
              label={t('shellAvatarUpload')}
              loading={avatarWrite.busy}
              disabled={avatarWrite.uncertain || uploadUnknown}
              onPress={uploadAvatar}
            />
          )}
          {file && (
            <Button
              kind="secondary"
              label={t('shellAvatarDiscard')}
              disabled={avatarWrite.busy || avatarWrite.uncertain}
              onPress={() => {
                setFile(undefined);
                setUploadUnknown(false);
              }}
            />
          )}
        </Card>
      )}
      {remote.data && <ErrorBox error={remote.error} retry={remote.reload} />}
      <RemoteState
        loading={remote.loading && !remote.data}
        error={remote.data ? undefined : remote.error}
        retry={remote.reload}
      >
        {remote.data && (
          <>
            <ProfileSection title={t('profilePersonal')} icon="user">
              <View>
                <ProfileInfoRow
                  label={t('dateOfBirth')}
                  value={
                    remote.data.profile.dateOfBirth
                      ? formatInstant(`${remote.data.profile.dateOfBirth}T00:00:00+07:00`, locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })
                      : t('profileNotSet')
                  }
                />
                <ProfileInfoRow
                  label={t('gender')}
                  value={
                    remote.data.profile.gender
                      ? ['MALE', 'FEMALE', 'OTHER'].includes(remote.data.profile.gender)
                        ? t(`profileGender_${remote.data.profile.gender}`)
                        : remote.data.profile.gender
                      : t('profileNotSet')
                  }
                />
                <ProfileInfoRow
                  label={t('profileExperience')}
                  value={
                    remote.data.profile.experience === undefined
                      ? t('profileNotSet')
                      : remote.data.profile.experience === 1
                        ? t('profileExperienceOne')
                        : `${remote.data.profile.experience} ${t('profileExperienceUnit')}`
                  }
                />
                <ProfileInfoRow label={t('email')} value={user?.email || t('profileNotSet')} />
                <ProfileInfoRow
                  label={t('phoneNumber')}
                  value={user?.phoneNumber || t('profileNotSet')}
                  onEdit={() => nav.navigate('Account')}
                  last
                />
              </View>
            </ProfileSection>
            <ProfileSection title={t('bio')} icon="message-circle">
              <Txt style={profileStyles.body}>{remote.data.profile.bio || t('profileNotSet')}</Txt>
            </ProfileSection>
            <ProfileSection title={t('profileServices')} icon="layers">
              <Txt muted style={profileStyles.body}>
                {t('profileServicesHint')}
              </Txt>
              {remote.data.skills.length ? (
                remote.data.skills.map((skill) => (
                  <View key={skill.id} style={profileStyles.service}>
                    <Feather
                      name="check-circle"
                      size={22}
                      color={colors.primary}
                      accessible={false}
                    />
                    <Txt style={profileStyles.serviceText}>{skill.name}</Txt>
                  </View>
                ))
              ) : (
                <Txt muted style={profileStyles.body}>
                  {t('profileServicesEmpty')}
                </Txt>
              )}
            </ProfileSection>
          </>
        )}
      </RemoteState>
      <Card style={profileStyles.linkCard}>
        <ProfileLink label={t('wallet')} icon="briefcase" onPress={() => nav.navigate('Wallet')} />
        <View style={profileStyles.divider} />
        <ProfileLink label={t('absences')} icon="user-x" onPress={() => nav.navigate('Absences')} />
        <View style={profileStyles.divider} />
        <ProfileLink
          label={t('assistantTitle')}
          icon="message-circle"
          onPress={() => nav.navigate('Assistant')}
        />
        <View style={profileStyles.divider} />
        <ProfileLink
          label={t('keptDeposits')}
          icon="credit-card"
          onPress={() => nav.navigate('KeptDeposits')}
        />
      </Card>
      <Card style={profileStyles.linkCard}>
        <ProfileLink
          label={t('certificates')}
          icon="award"
          onPress={() => nav.navigate('Certificates')}
        />
        <View style={profileStyles.divider} />
        <ProfileLink
          label={t('profileSecurity')}
          icon="shield"
          expanded={securityExpanded}
          onPress={() => setSecurityExpanded(!securityExpanded)}
        />
        {securityExpanded && (
          <View style={profileStyles.securityLinks}>
            <ProfileLink
              label={t('changePassword')}
              icon="lock"
              onPress={() => nav.navigate('Account')}
            />
            <ProfileLink
              label={t('shellSecurity')}
              icon="smartphone"
              onPress={() => nav.navigate('SecuritySessions')}
            />
          </View>
        )}
      </Card>
      <Button
        kind="danger"
        label={t('logout')}
        icon="log-out"
        disabled={avatarWrite.busy}
        onPress={() =>
          void confirm(t('logoutQuestion'), '', t('logout'), t('cancel')).then((ok) => {
            if (ok) void logout();
          })
        }
      />
      <ProfileSection title={t('language')} icon="globe">
        <Chips
          values={[
            { value: 'vi', label: t('languageVietnamese') },
            { value: 'en', label: t('languageEnglish') },
          ]}
          value={locale}
          onChange={(v) => setLocale(v === 'en' ? 'en' : 'vi')}
        />
      </ProfileSection>
    </Screen>
  );
}
export function AccountScreen() {
  const { api, user, t } = useApp();
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saved, setSaved] = useState(false);
  const write = useWrite();
  const dirty =
    name !== (user?.fullName ?? '') ||
    phone !== (user?.phoneNumber ?? '') ||
    !!(current || next || confirmation);
  useDirty(dirty, write.busy);
  return (
    <Screen>
      <PageHeader title={t('account')} description={t('shellAccountHint')} />
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
          hint={t('shellPhoneHint')}
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
          hint={t('shellPasswordRules')}
          editable={!write.busy}
        />
        <Field
          label={t('shellPasswordConfirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
          editable={!write.busy}
          error={confirmation && confirmation !== next ? t('shellPasswordMismatch') : undefined}
        />
        <Txt muted>{t('shellPasswordSignIn')}</Txt>
        <Button
          label={t('changePassword')}
          loading={write.busy}
          disabled={write.uncertain || !current || !isStrongPassword(next) || confirmation !== next}
          onPress={() =>
            void write.run(
              () =>
                api.request('POST', '/users/me/change-password', {
                  currentPassword: current,
                  newPassword: next,
                }),
              async () => {
                setCurrent('');
                setNext('');
                setConfirmation('');
                await api.forgetSession();
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
export { ProviderScheduleScreen } from '../availability/screen';

const profileStyles = StyleSheet.create({
  card: { padding: 16, gap: 20, elevation: 1 },
  identity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 },
  identityText: { flex: 1, minWidth: 160, alignItems: 'flex-start', gap: 6 },
  avatarButton: { width: 80, height: 80, borderRadius: 40 },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  initials: { fontSize: 26, lineHeight: 34, color: colors.primary, fontWeight: '800' },
  camera: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  body: { fontSize: 17, lineHeight: 26 },
  completeness: { gap: 8 },
  progressHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressLabel: { flexShrink: 1, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.pale,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  serviceText: { flex: 1, fontSize: 17, lineHeight: 26, color: colors.primary, fontWeight: '500' },
  linkCard: { paddingVertical: 8, paddingHorizontal: 16, gap: 4, elevation: 1 },
  divider: { height: 1, backgroundColor: colors.line },
  securityLinks: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger },
});
