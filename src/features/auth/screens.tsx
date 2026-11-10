import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
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
  const passwordInput = useRef<TextInputInstance>(null);
  const write = useWrite();
  const canSignIn = !!(email.trim() && password) && !write.busy;
  function signIn() {
    if (canSignIn) write.run(() => api.login(email, password));
  }
  return (
    <View style={styles.loginBackground}>
      <Image
        source={require('../../../assets/images/login-leaves.png')}
        style={styles.leaves}
        pointerEvents="none"
        importantForAccessibility="no"
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.loginScroll}>
          <View style={styles.loginContent}>
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
            <View style={styles.brand}>
              <Image
                source={require('../../../assets/images/careconnect-login-logo.png')}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('app')}
                resizeMode="contain"
                style={styles.brandLogo}
              />
              <Txt style={styles.tagline}>{t('tagline')}</Txt>
            </View>
            <Card style={styles.loginCard}>
              <Field
                label={t('email')}
                labelIcon="mail"
                placeholder={t('loginEmailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoCorrect={false}
                editable={!write.busy}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
              />
              <View>
                <Field
                  ref={passwordInput}
                  label={t('password')}
                  labelIcon="lock"
                  placeholder={t('loginPasswordPlaceholder')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!write.busy}
                  returnKeyType="go"
                  onSubmitEditing={signIn}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(show ? 'hide' : 'show')}
                      accessibilityState={{ disabled: write.busy }}
                      onPress={() => setShow((current) => !current)}
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
                disabled={!canSignIn}
                icon="arrow-right"
                style={[styles.signInButton, canSignIn && styles.signInGradient]}
                disabledStyle={styles.signInDisabled}
                onPress={signIn}
              />
            </Card>
          </View>
          <View
            style={styles.footer}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={require('../../../assets/images/login-hills.png')}
              style={styles.hills}
              resizeMode="stretch"
              fadeDuration={0}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
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
  loginBackground: {
    flex: 1,
    backgroundColor: '#EDF7EE',
    experimental_backgroundImage: 'linear-gradient(155deg, #DEEFE0, #F7FBF6 38%, #EAF6E9)',
  },
  safe: { flex: 1 },
  loginScroll: { flexGrow: 1 },
  loginContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 448,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  leaves: { position: 'absolute', top: 0, left: 0, width: 200, height: 100 },
  footer: { flexGrow: 1, minHeight: 120, justifyContent: 'flex-end' },
  hills: { width: '100%', height: 120 },
  loginCard: {
    elevation: 4,
    shadowColor: colors.primaryDeep,
    borderWidth: 0,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  textLink: {
    alignSelf: 'flex-end',
    minHeight: 48,
    justifyContent: 'center',
    paddingLeft: 8,
    maxWidth: '100%',
  },
  textLinkLabel: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  brand: { alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 24 },
  brandLogo: { width: 208, height: 136 },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  languages: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#C8DFCE',
    backgroundColor: '#F3FAF4',
    overflow: 'hidden',
  },
  languageButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageActive: {
    backgroundColor: colors.primary,
    experimental_backgroundImage: 'linear-gradient(135deg, #26864E, #075B38)',
  },
  languageText: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.neutral },
  languageActiveText: { color: colors.white },
  eyeButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  signInButton: {
    minHeight: 52,
    flexDirection: 'row-reverse',
  },
  signInGradient: {
    experimental_backgroundImage: 'linear-gradient(100deg, #25834B, #075735)',
  },
  signInDisabled: { opacity: 1, backgroundColor: '#557662' },
  pressed: { opacity: 0.65 },
});
