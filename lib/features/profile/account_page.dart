import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/l10n.dart';
import '../../core/validation.dart';
import '../../core/widgets.dart';

class AccountPage extends ConsumerStatefulWidget {
  const AccountPage({super.key, this.passwordOnly = false});
  final bool passwordOnly;
  @override
  ConsumerState<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends ConsumerState<AccountPage> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(
        text: ref.read(authProvider).user?.fullName,
      ),
      phone = TextEditingController(
        text: ref.read(authProvider).user?.phoneNumber,
      );
  final current = TextEditingController(),
      password = TextEditingController(),
      repeated = TextEditingController();
  bool dirty = false, busy = false;
  @override
  void dispose() {
    for (final c in [name, phone, current, password, repeated]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => UnsavedGuard(
    dirty: dirty || busy,
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          context.t(widget.passwordOnly ? 'changePassword' : 'account'),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: form,
          onChanged: () {
            if (!dirty) setState(() => dirty = true);
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!widget.passwordOnly) ...[
                Text(ref.read(authProvider).user?.email ?? ''),
                const SizedBox(height: 20),
                Field(
                  'fullName',
                  name,
                  required: true,
                  maxLength: 255,
                  enabled: !busy,
                ),
                Field(
                  'phone',
                  phone,
                  keyboard: TextInputType.phone,
                  enabled: !busy,
                  validator: (v) => RegExp(r'^\d{10,11}$').hasMatch(v ?? '')
                      ? null
                      : context.t('invalidNumber'),
                ),
              ] else ...[
                Field(
                  'currentPassword',
                  current,
                  required: true,
                  obscure: true,
                  enabled: !busy,
                ),
                Field(
                  'newPassword',
                  password,
                  obscure: true,
                  enabled: !busy,
                  validator: (v) => strongPassword(v ?? '')
                      ? null
                      : context.t('passwordRules'),
                ),
                Field(
                  'confirmPassword',
                  repeated,
                  obscure: true,
                  enabled: !busy,
                  validator: (v) =>
                      v == password.text ? null : context.t('passwordMismatch'),
                ),
              ],
              ActionButton(
                label: 'save',
                enabled: !busy,
                action: () async {
                  if (!form.currentState!.validate()) return;
                  setState(() => busy = true);
                  try {
                    final api = ref.read(apiProvider),
                        auth = ref.read(authProvider);
                    if (widget.passwordOnly) {
                      await api.post(
                        '/users/me/change-password',
                        data: {
                          'currentPassword': current.text,
                          'newPassword': password.text,
                        },
                      );
                      if (!context.mounted) return;
                      setState(() {
                        dirty = false;
                        busy = false;
                      });
                      showMessage(context, 'passwordChanged');
                      await auth.logout();
                    } else {
                      await api.request(
                        'PUT',
                        '/users/me',
                        data: {
                          'fullName': name.text.trim(),
                          'phoneNumber': phone.text.trim(),
                        },
                      );
                      await auth.reloadUser();
                      if (!context.mounted) return;
                      setState(() {
                        dirty = false;
                        busy = false;
                      });
                      showMessage(context, 'saved');
                      context.pop();
                    }
                  } finally {
                    if (mounted) setState(() => busy = false);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
