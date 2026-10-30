import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../core/validation.dart';
import '../../core/widgets.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(), password = TextEditingController();
  bool hidden = true, busy = false, attempted = false;
  Object? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> login() async {
    setState(() => attempted = true);
    if (!form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(authProvider).login(email.text, password.text);
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: AutofillGroup(
              child: Form(
                key: form,
                autovalidateMode: attempted
                    ? AutovalidateMode.always
                    : AutovalidateMode.disabled,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () =>
                            ref.read(localeProvider.notifier).toggle(),
                        child: Text(context.t('language')),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: brand,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Icon(
                            Icons.favorite_outline,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CareConnect',
                                style: Theme.of(context).textTheme.headlineSmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: brand,
                                    ),
                              ),
                              Text(
                                context.t('caregiver'),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 44),
                    Text(
                      context.t('welcome'),
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      context.t('loginIntro'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: email,
                      enabled: !busy,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.username],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: context.t('email'),
                        prefixIcon: const Icon(Icons.mail_outline),
                      ),
                      validator: (v) =>
                          RegExp(
                            r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                          ).hasMatch(v?.trim() ?? '')
                          ? null
                          : context.t('emailInvalid'),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: password,
                      enabled: !busy,
                      obscureText: hidden,
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) {
                        if (!busy) login();
                      },
                      decoration: InputDecoration(
                        labelText: context.t('password'),
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: context.t('showPassword'),
                          onPressed: () => setState(() => hidden = !hidden),
                          icon: Icon(
                            hidden
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? context.t('required') : null,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: busy
                            ? null
                            : () => context.push('/recovery'),
                        child: Text(context.t('forgot')),
                      ),
                    ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          context.errorText(error!),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    FilledButton(
                      onPressed: busy ? null : login,
                      child: busy
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(context.t('login')),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      context.t('accountProvided'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class RecoveryPage extends ConsumerStatefulWidget {
  const RecoveryPage({super.key});
  @override
  ConsumerState<RecoveryPage> createState() => _RecoveryPageState();
}

class _RecoveryPageState extends ConsumerState<RecoveryPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      otp = TextEditingController(),
      password = TextEditingController(),
      repeated = TextEditingController();
  bool sent = false, dirty = false;
  @override
  void dispose() {
    for (final c in [email, otp, password, repeated]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => UnsavedGuard(
    dirty: dirty,
    child: Scaffold(
      appBar: AppBar(title: Text(context.t('recovery'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: form,
          onChanged: () {
            if (!dirty) setState(() => dirty = true);
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Field(
                'email',
                email,
                enabled: !sent,
                keyboard: TextInputType.emailAddress,
                validator: (v) =>
                    RegExp(
                      r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                    ).hasMatch(v?.trim() ?? '')
                    ? null
                    : context.t('emailInvalid'),
              ),
              if (!sent)
                ActionButton(
                  label: 'sendCode',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    await ref
                        .read(apiProvider)
                        .post(
                          '/auth/forgot-password',
                          authenticated: false,
                          data: {'email': email.text.trim()},
                        );
                    if (mounted) setState(() => sent = true);
                  },
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Text(context.t('codeSent')),
                ),
                Field(
                  'otp',
                  otp,
                  keyboard: TextInputType.number,
                  maxLength: 6,
                  validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '')
                      ? null
                      : context.t('otpInvalid'),
                ),
                Field(
                  'newPassword',
                  password,
                  obscure: true,
                  validator: (v) => strongPassword(v ?? '')
                      ? null
                      : context.t('passwordRules'),
                ),
                Field(
                  'confirmPassword',
                  repeated,
                  obscure: true,
                  validator: (v) =>
                      v == password.text ? null : context.t('passwordMismatch'),
                ),
                ActionButton(
                  label: 'resetPassword',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    await ref
                        .read(apiProvider)
                        .post(
                          '/auth/reset-password',
                          authenticated: false,
                          data: {
                            'email': email.text.trim(),
                            'otpCode': otp.text,
                            'newPassword': password.text,
                          },
                        );
                    if (!context.mounted) return;
                    setState(() => dirty = false);
                    showMessage(context, 'resetDone');
                    context.go('/login');
                  },
                ),
                const SizedBox(height: 16),
                ActionButton(
                  label: 'sendCode',
                  outlined: true,
                  action: () async {
                    await ref
                        .read(apiProvider)
                        .post(
                          '/auth/forgot-password',
                          authenticated: false,
                          data: {'email': email.text.trim()},
                        );
                    if (context.mounted) showMessage(context, 'codeSent');
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
