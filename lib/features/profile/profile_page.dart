import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../core/uploads.dart';
import '../../core/widgets.dart';
import 'models.dart';
import 'media_panel.dart';

class ProfileData {
  ProfileData(this.profile, this.services, this.certificates);
  final CaregiverProfile profile;
  final List<String> services;
  final List<Certificate> certificates;
}

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});
  Future<ProfileData> load(WidgetRef ref) async {
    final api = ref.read(apiProvider);
    final profile = CaregiverProfile.fromJson(
      object(await api.get('/caregivers/me')),
    );
    final skills = array(
      await api.get('/caregivers/${profile.id}/services'),
    ).map((v) => string(object(v)['serviceName'])).toList();
    final certificates = array(
      await api.get('/certificates/caregivers/${profile.id}'),
    ).map((v) => Certificate.fromJson(object(v))).toList();
    return ProfileData(profile, skills, certificates);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => DataView<ProfileData>(
    load: () => load(ref),
    builder: (data, reload) => RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Panel(
            title: context.t('professional'),
            icon: Icons.badge_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.profile.fullName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: brand,
                  ),
                ),
                const SizedBox(height: 8),
                Text(data.profile.centerName),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusChip(data.profile.status),
                    StatusChip(data.profile.verification),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  '${context.t('experience')}: ${data.profile.experience ?? '—'}',
                ),
                Text(
                  '${context.t('rating')}: ${data.profile.rating ?? '—'} (${data.profile.ratingCount})',
                ),
                if (data.profile.bio.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(data.profile.bio),
                  ),
              ],
            ),
          ),
          Panel(
            title: context.t('avatar'),
            child: MediaPanel(
              ownerType: 'CAREGIVER_PROFILE',
              ownerId: data.profile.id,
            ),
          ),
          Panel(
            title: context.t('skills'),
            child: data.services.isEmpty
                ? const EmptyState()
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final s in data.services) Chip(label: Text(s)),
                    ],
                  ),
          ),
          Panel(
            title: context.t('certificates'),
            icon: Icons.school_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data.certificates.isEmpty) const EmptyState(),
                for (final certificate in data.certificates)
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: Text(certificate.name),
                    subtitle: Text(certificate.issuedBy),
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: StatusChip(certificate.status),
                      ),
                      if (certificate.reason.isNotEmpty)
                        Text(certificate.reason),
                      const SizedBox(height: 16),
                      MediaPanel(
                        ownerType: 'CERTIFICATE',
                        ownerId: certificate.id,
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                const SizedBox(height: 16),
                ActionButton(
                  label: 'addCertificate',
                  outlined: true,
                  action: () async {
                    await context.push(
                      '/profile/certificates/new?caregiverId=${data.profile.id}',
                    );
                    reload();
                  },
                ),
              ],
            ),
          ),
          ActionButton(
            label: 'account',
            outlined: true,
            icon: Icons.manage_accounts_outlined,
            action: () async {
              await context.push('/account');
            },
          ),
          const SizedBox(height: 12),
          ActionButton(
            label: 'changePassword',
            outlined: true,
            icon: Icons.password_outlined,
            action: () async {
              await context.push('/password');
            },
          ),
          const SizedBox(height: 12),
          ActionButton(
            label: 'language',
            outlined: true,
            icon: Icons.translate,
            action: () => ref.read(localeProvider.notifier).toggle(),
          ),
          const SizedBox(height: 12),
          ActionButton(
            label: 'logout',
            outlined: true,
            icon: Icons.logout,
            action: () async {
              if (!await confirm(context, 'logoutConfirm')) return;
              if (!context.mounted) return;
              final messenger = ScaffoldMessenger.of(context),
                  message = context.t('logoutLocal');
              final revoked = await ref.read(authProvider).logout();
              if (!revoked) {
                messenger.showSnackBar(SnackBar(content: Text(message)));
              }
            },
          ),
          const SizedBox(height: 24),
        ],
      ),
    ),
  );
}

class AddCertificatePage extends ConsumerStatefulWidget {
  const AddCertificatePage({super.key, required this.caregiverId});
  final String caregiverId;
  @override
  ConsumerState<AddCertificatePage> createState() => _AddCertificatePageState();
}

class _AddCertificatePageState extends ConsumerState<AddCertificatePage> {
  final form = GlobalKey<FormState>(),
      name = TextEditingController(),
      issuer = TextEditingController();
  PickedUpload? file;
  String? pendingId;
  bool dirty = false, busy = false;
  @override
  void dispose() {
    name.dispose();
    issuer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => UnsavedGuard(
    dirty: dirty || busy,
    child: Scaffold(
      appBar: AppBar(title: Text(context.t('addCertificate'))),
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
              Field(
                'certificateName',
                name,
                required: true,
                maxLength: 255,
                enabled: pendingId == null && !busy,
              ),
              Field(
                'issuedBy',
                issuer,
                required: true,
                maxLength: 255,
                enabled: pendingId == null && !busy,
              ),
              ActionButton(
                label: 'chooseFile',
                outlined: true,
                enabled: !busy,
                action: () async {
                  final selected = await pickUpload(certificate: true);
                  if (selected != null && mounted) {
                    setState(() {
                      file = selected;
                      dirty = true;
                    });
                  }
                },
              ),
              if (file != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(file!.name),
                ),
              ActionButton(
                label: pendingId == null ? 'upload' : 'retryUpload',
                enabled: !busy && file != null,
                action: () async {
                  if (!form.currentState!.validate() || file == null) return;
                  setState(() => busy = true);
                  try {
                    final api = ref.read(apiProvider);
                    if (pendingId == null) {
                      final created = object(
                        await api.post(
                          '/certificates/caregivers/${widget.caregiverId}',
                          data: {
                            'certificateName': name.text.trim(),
                            'issuedBy': issuer.text.trim(),
                          },
                        ),
                      );
                      pendingId = string(created['id']);
                    }
                    await api.post(
                      '/provider-media/CERTIFICATE/$pendingId',
                      data: await file!.form(),
                    );
                    if (!context.mounted) return;
                    setState(() {
                      dirty = false;
                      busy = false;
                    });
                    context.pop();
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
