import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth.dart';
import '../../core/api_client.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/uploads.dart';
import '../../core/widgets.dart';
import '../sessions/models.dart';
import 'models.dart';
import 'repository.dart';

class ReportPage extends ConsumerWidget {
  const ReportPage({
    super.key,
    required this.sessionId,
    required this.bookingId,
  });
  final String sessionId, bookingId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: Text(context.t('report'))),
    body: DataView<(CareReport, CareSession)>(
      load: () async {
        final api = ref.read(apiProvider);
        final report =
            await ReportRepository(api).find(bookingId, sessionId) ??
            CareReport.empty(sessionId);
        final session = CareSession.fromJson(
          object(await api.get('/care-sessions/$sessionId')),
        );
        return (report, session);
      },
      builder: (data, reload) => ReportEditor(
        initial: data.$1,
        bookingId: bookingId,
        sessionEnded: data.$2.status == 'ENDED',
      ),
    ),
  );
}

class ReportEditor extends ConsumerStatefulWidget {
  const ReportEditor({
    super.key,
    required this.initial,
    required this.bookingId,
    required this.sessionEnded,
  });
  final CareReport initial;
  final String bookingId;
  final bool sessionEnded;
  @override
  ConsumerState<ReportEditor> createState() => _ReportEditorState();
}

class _ReportEditorState extends ConsumerState<ReportEditor> {
  late CareReport report = widget.initial;
  late String condition = report.condition;
  late final fields = <String, TextEditingController>{
    'summary': TextEditingController(text: report.summary),
    'mealNotes': TextEditingController(text: report.mealNotes),
    'medicationNotes': TextEditingController(text: report.medicationNotes),
    'mobilityNotes': TextEditingController(text: report.mobilityNotes),
    'moodNotes': TextEditingController(text: report.moodNotes),
    'recommendations': TextEditingController(text: report.recommendations),
  };
  final form = GlobalKey<FormState>();
  bool dirty = false, busy = false, needsReconcile = false;
  late bool sessionEnded = widget.sessionEnded;

  void adopt(CareReport fresh) {
    report = fresh;
    condition = fresh.condition;
    final values = fresh.toRequest();
    for (final entry in fields.entries) {
      entry.value.text = string(values[entry.key]);
    }
    dirty = false;
  }

  Future<void> reloadReport() async {
    if (busy) return;
    if (dirty && !await confirm(context, 'unsaved')) return;
    setState(() => busy = true);
    try {
      final api = ref.read(apiProvider);
      final fresh =
          await ReportRepository(
            api,
          ).find(widget.bookingId, report.sessionId) ??
          CareReport.empty(report.sessionId);
      final session = CareSession.fromJson(
        object(await api.get('/care-sessions/${report.sessionId}')),
      );
      if (mounted) {
        setState(() {
          adopt(fresh);
          needsReconcile = false;
          sessionEnded = session.status == 'ENDED';
        });
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  void changed() {
    if (!dirty) setState(() => dirty = true);
  }

  Future<void> save({bool submit = false}) async {
    if (!report.editable || !form.currentState!.validate() || busy) return;
    if (submit && !sessionEnded) return;
    if (submit && !await confirm(context, 'submitConfirm')) return;
    setState(() => busy = true);
    try {
      final repo = ReportRepository(ref.read(apiProvider));
      if (needsReconcile && report.id.isNotEmpty) {
        report = CareReport.fromJson(
          object(await ref.read(apiProvider).get('/care-reports/${report.id}')),
        );
        needsReconcile = false;
      }
      // Reconcile a previous create with a lost response before creating again.
      if (report.id.isEmpty) {
        report = await repo.find(widget.bookingId, report.sessionId) ?? report;
      }
      if (!report.editable) {
        if (mounted) setState(() => adopt(report));
        return;
      }
      report = await repo.save(
        CareReport.fromJson({
          ...report.toRequest(),
          'id': report.id,
          'status': report.status,
          'overallCondition': condition,
          for (final e in fields.entries) e.key: e.value.text.trim(),
        }),
      );
      if (mounted) setState(() => dirty = false);
      if (submit) report = await repo.submit(report.id);
      if (mounted) {
        setState(() {});
        showMessage(context, 'saved');
      }
    } on ApiFailure catch (e) {
      if (e.kind == 'network') needsReconcile = true;
      rethrow;
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> photo({String? removeId}) async {
    if (busy || !report.editable || report.id.isEmpty || dirty) return;
    if (removeId != null && !await confirm(context, 'deleteConfirm')) return;
    setState(() => busy = true);
    try {
      final api = ref.read(apiProvider), path = '/care-reports/${report.id}';
      if (removeId == null) {
        final upload = await pickUpload();
        if (upload == null) return;
        report = CareReport.fromJson(
          object(await api.post('$path/photos', data: await upload.form())),
        );
      } else {
        await api.request('DELETE', '$path/photos/$removeId');
        report = CareReport.fromJson(object(await api.get(path)));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => UnsavedGuard(
    dirty: dirty || busy,
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: form,
        onChanged: changed,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: StatusChip(report.status),
            ),
            const SizedBox(height: 16),
            Text(context.t('reportHint')),
            Align(
              alignment: Alignment.centerRight,
              child: ActionButton(
                label: 'refresh',
                outlined: true,
                enabled: !busy,
                action: reloadReport,
              ),
            ),
            const SizedBox(height: 24),
            DropdownButtonFormField<String>(
              key: ValueKey('${report.id}:${report.status}:$condition'),
              initialValue: condition.isEmpty ? null : condition,
              isExpanded: true,
              decoration: InputDecoration(labelText: context.t('condition')),
              items: [
                for (final c in [
                  'STABLE',
                  'IMPROVED',
                  'DECLINED',
                  'NEEDS_ATTENTION',
                ])
                  DropdownMenuItem(value: c, child: Text(context.t(c))),
              ],
              validator: (v) =>
                  v == null || v.isEmpty ? context.t('required') : null,
              onChanged: report.editable && !busy
                  ? (v) {
                      setState(() => condition = v ?? '');
                      changed();
                    }
                  : null,
            ),
            const SizedBox(height: 20),
            for (final e in fields.entries)
              Field(
                e.key,
                e.value,
                enabled: report.editable && !busy,
                required: e.key == 'summary',
                maxLength: e.key == 'summary' ? 4000 : 2000,
                lines: e.key == 'summary' ? 4 : 2,
              ),
            if (report.editable)
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  ActionButton(
                    label: 'saveDraft',
                    enabled: !busy,
                    outlined: true,
                    action: save,
                  ),
                  ActionButton(
                    label: 'submitReport',
                    enabled: !busy && sessionEnded,
                    action: () => save(submit: true),
                  ),
                ],
              ),
            const SizedBox(height: 24),
            if (report.editable && !sessionEnded)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(context.t('reportAfterEnd')),
              ),
            Panel(
              title: context.t('photos'),
              icon: Icons.photo_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final p in report.photos)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        children: [
                          if (Uri.tryParse(p.url)?.scheme == 'https')
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                p.url,
                                height: 180,
                                width: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (c, e, s) => const Icon(
                                  Icons.broken_image_outlined,
                                  size: 48,
                                ),
                              ),
                            ),
                          if (report.editable)
                            ActionButton(
                              label: 'remove',
                              outlined: true,
                              enabled: !busy && !dirty,
                              action: () => photo(removeId: p.id),
                            ),
                        ],
                      ),
                    ),
                  if (report.editable) ...[
                    if (report.id.isEmpty || dirty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(context.t('saveBeforePhoto')),
                      ),
                    ActionButton(
                      label: 'addPhoto',
                      outlined: true,
                      enabled:
                          !busy &&
                          !dirty &&
                          report.id.isNotEmpty &&
                          report.photos.length < 5,
                      action: photo,
                    ),
                  ],
                  if (report.photos.isEmpty && !report.editable)
                    const EmptyState(),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
