import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Routes } from '../../app/routes';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDirty, useWrite } from '../../core/hooks';
import { Button, Card, Chips, ErrorBox, Field, Screen, Title, Txt, colors } from '../../core/ui';
export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const { api, t, locale, setLocale } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const write = useWrite();
  return (
    <Screen>
      <View style={{ paddingTop: 22, gap: 18 }}>
        <View
          style={{
            backgroundColor: colors.primary,
            width: 64,
            height: 64,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="heart" size={32} color="white" />
        </View>
        <Txt style={{ fontSize: 23, fontWeight: '800', color: colors.primary }}>{t('app')}</Txt>
        <Title>{t('loginTitle')}</Title>
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
          editable={!write.busy}
        />
        <Field
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="current-password"
          editable={!write.busy}
        />
        <Button kind="secondary" label={t(show ? 'hide' : 'show')} onPress={() => setShow(!show)} />
        <ErrorBox error={write.error} />
        <Button
          label={t('login')}
          loading={write.busy}
          disabled={!email.trim() || !password}
          onPress={() => void write.run(() => api.login(email, password))}
        />
        <Button
          kind="secondary"
          label={t('forgot')}
          onPress={() => navigation.navigate('Forgot')}
        />
      </Card>
      <Chips
        values={[
          { value: 'vi', label: 'Tiếng Việt' },
          { value: 'en', label: 'English' },
        ]}
        value={locale}
        onChange={(v) => setLocale(v === 'en' ? 'en' : 'vi')}
      />
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
            <Txt muted>{t('passwordHint')}</Txt>
            <Button
              label={t('resetPassword')}
              disabled={write.uncertain || !/^\d{6}$/.test(code) || password.length < 8}
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
