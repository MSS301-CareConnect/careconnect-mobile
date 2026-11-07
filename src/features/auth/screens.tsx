import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { BrandMark } from '../../core/brand';
import { Routes } from '../../app/routes';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDirty, useWrite } from '../../core/hooks';
import { Button, Card, ErrorBox, Field, Screen, Title, Txt, colors } from '../../core/ui';
import { isStrongPassword } from '../../core/validation';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const { api, t, locale, setLocale } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const write = useWrite();
  return (
    <Screen topInset>
      <View style={styles.intro}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <BrandMark size={40} />
            <Txt style={styles.brandName} numberOfLines={1}>
              {t('app')}
            </Txt>
          </View>
          <View style={styles.languages}>
            {(['vi', 'en'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={t(value === 'vi' ? 'languageVietnamese' : 'languageEnglish')}
                accessibilityState={{ selected: locale === value }}
                onPress={() => setLocale(value)}
                style={({ pressed }) => [
                  styles.languageButton,
                  locale === value && styles.languageActive,
                  pressed && styles.pressed,
                ]}
              >
                <Txt style={[styles.languageText, locale === value && styles.languageActiveText]}>
                  {t(value === 'vi' ? 'languageVie' : 'languageEng')}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
        <Title>{t('loginTitle')}</Title>
        <Txt style={styles.role}>{t('shellSignInRole')}</Txt>
        <Txt muted>{t('loginHint')}</Txt>
      </View>
      <Card>
        <Field
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
          editable={!write.busy}
        />
        <Field
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!write.busy}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(show ? 'hide' : 'show')}
              accessibilityState={{ disabled: write.busy }}
              onPress={() => setShow(!show)}
              disabled={write.busy}
              style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
            >
              <Feather
                name={show ? 'eye-off' : 'eye'}
                size={22}
                color={colors.primary}
                accessible={false}
              />
            </Pressable>
          }
        />
        <View style={styles.recoveryRow}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('resetPassword')}
            accessibilityState={{ disabled: write.busy }}
            disabled={write.busy}
            onPress={() => navigation.navigate('Forgot')}
            style={({ pressed }) => [
              styles.textLink,
              write.busy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Txt style={styles.textLinkLabel}>{t('resetPassword')}</Txt>
          </Pressable>
        </View>
        <ErrorBox error={write.error} />
        <Button
          label={t('login')}
          loading={write.busy}
          disabled={!email.trim() || !password}
          onPress={() => void write.run(() => api.login(email, password))}
        />
      </Card>
      <Txt muted style={{ textAlign: 'center', fontSize: 12 }}>
        {t('tagline')}
      </Txt>
    </Screen>
  );
}
export function ForgotScreen() {
  const { api, t } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [success, setSuccess] = useState(false);
  const write = useWrite();
  useDirty(!!(email || code || password) && !success, write.busy);
  return (
    <Screen>
      <Title>{t('forgotTitle')}</Title>
      <Card>
        <Field
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!write.busy}
        />
        <Button
          label={t('sendCode')}
          loading={write.busy}
          disabled={!email.trim() || write.uncertain}
          onPress={() =>
            void write.run(
              () => api.publicRequest('/auth/forgot-password', { email: email.trim() }),
              () => setSent(true),
            )
          }
        />
        {sent && (
          <>
            <Txt>{t('codeSent')}</Txt>
            <Field
              label={t('otp')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Field
              label={t('newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Txt muted>{t('shellPasswordRules')}</Txt>
            <Button
              label={t('resetPassword')}
              disabled={write.uncertain || !/^\d{6}$/.test(code) || !isStrongPassword(password)}
              loading={write.busy}
              onPress={() =>
                void write.run(
                  () =>
                    api.publicRequest('/auth/reset-password', {
                      email: email.trim(),
                      otpCode: code,
                      newPassword: password,
                    }),
                  () => {
                    setSuccess(true);
                    setPassword('');
                    setCode('');
                  },
                )
              }
            />
          </>
        )}
        <ErrorBox error={write.error} />
        {success && <Txt>{t('saved')}</Txt>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recoveryRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  textLink: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  textLinkLabel: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  brandName: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.primary,
    flexShrink: 1,
  },
  languages: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  languageButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pale,
  },
  languageActive: { backgroundColor: colors.primary },
  languageText: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.primary },
  languageActiveText: { color: colors.white },
  eyeButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  intro: { paddingTop: 16, gap: 16 },
  role: { fontSize: 13, lineHeight: 20, color: colors.primary, fontWeight: '700' },
});
