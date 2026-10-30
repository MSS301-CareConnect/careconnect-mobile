import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/device.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/widgets.dart';
import 'models.dart';

class SessionPage extends ConsumerStatefulWidget {
  const SessionPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends ConsumerState<SessionPage> {
  bool busy = false;
  int notesRevision = 0;
  Future<void> mutate(
    Future<void> Function() action,
    Future<void> Function() reload,
  ) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await action();
      await reload();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiProvider), path = '/care-sessions/${widget.id}';
    return Scaffold(
      appBar: AppBar(title: Text(context.t('session'))),
      body: DataView<CareSession>(
        load: () async => CareSession.fromJson(object(await api.get(path))),
        builder: (session, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  StatusChip(session.status),
                  if (session.checkInAt != null)
                    Text(dateLabel(context, session.checkInAt!, time: true)),
                ],
              ),
              const SizedBox(height: 20),
              if (!session.active)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(context.t('sessionClosed')),
                ),
              Panel(
                title: context.t('checklist'),
                icon: Icons.checklist,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (session.tasks.isEmpty) const EmptyState(),
                    for (final task in session.tasks)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  task.status == 'DONE'
                                      ? Icons.check_circle
                                      : task.status == 'SKIPPED'
                                      ? Icons.do_not_disturb_on_outlined
                                      : Icons.radio_button_unchecked,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    task.title,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleSmall,
                                  ),
                                ),
                              ],
                            ),
                            if (task.scheduledTime.isNotEmpty)
                              Text(task.scheduledTime),
                            if (task.skipReason.isNotEmpty)
                              Text(task.skipReason),
                            if (task.note.isNotEmpty) Text(task.note),
                            const SizedBox(height: 8),
                            StatusChip(task.status),
                            if (session.active)
                              Padding(
                                padding: const EdgeInsets.only(top: 12),
                                child: Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    ActionButton(
                                      label: task.status == 'PENDING'
                                          ? 'done'
                                          : 'undo',
                                      enabled: !busy,
                                      action: () => mutate(() async {
                                        await api.request(
                                          'PATCH',
                                          '$path/tasks/${task.id}',
                                          data: taskUpdate(
                                            task.status == 'PENDING'
                                                ? 'DONE'
                                                : 'PENDING',
                                          ),
                                        );
                                      }, reload),
                                    ),
                                    if (task.status == 'PENDING')
                                      ActionButton(
                                        label: 'skip',
                                        enabled: !busy,
                                        outlined: true,
                                        action: () async {
                                          final reason = await askText(
                                            context,
                                            'reason',
                                          );
                                          if (reason != null) {
                                            await mutate(() async {
                                              await api.request(
                                                'PATCH',
                                                '$path/tasks/${task.id}',
                                                data: taskUpdate(
                                                  'SKIPPED',
                                                  reason,
                                                ),
                                              );
                                            }, reload);
                                          }
                                        },
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    if (session.active)
                      ActionButton(
                        label: 'addTask',
                        outlined: true,
                        enabled: !busy,
                        icon: Icons.add,
                        action: () async {
                          final title = await askText(
                            context,
                            'taskTitle',
                            maxLength: 200,
                          );
                          if (title != null) {
                            await mutate(() async {
                              await api.post(
                                '$path/tasks',
                                data: {'title': title},
                              );
                            }, reload);
                          }
                        },
                      ),
                  ],
                ),
              ),
              Panel(
                title: context.t('notes'),
                icon: Icons.notes_outlined,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (session.active)
                      ActionButton(
                        label: 'addNote',
                        enabled: !busy,
                        outlined: true,
                        action: () async {
                          await context.push(
                            '/sessions/${widget.id}/notes/new',
                          );
                          if (mounted) setState(() => notesRevision++);
                        },
                      ),
                    NotesList(
                      key: ValueKey(notesRevision),
                      sessionId: widget.id,
                    ),
                  ],
                ),
              ),
              ActionButton(
                label: 'report',
                outlined: true,
                action: () async {
                  await context.push(
                    '/reports/${widget.id}?bookingId=${session.bookingId}',
                  );
                },
              ),
              if (session.active) ...[
                const SizedBox(height: 16),
                ActionButton(
                  label: 'checkOut',
                  enabled: !busy,
                  icon: Icons.logout,
                  action: () async {
                    if (!await confirm(context, 'checkOutConfirm')) return;
                    await mutate(() async {
                      await api.post(
                        '$path/end',
                        data: await optionalCoordinates(),
                      );
                    }, reload);
                  },
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class NotesList extends ConsumerStatefulWidget {
  const NotesList({super.key, required this.sessionId});
  final String sessionId;
  @override
  ConsumerState<NotesList> createState() => _NotesListState();
}

class _NotesListState extends ConsumerState<NotesList> {
  int page = 0;
  @override
  Widget build(BuildContext context) => DataView<PageData<SessionNote>>(
    key: ValueKey(page),
    load: () async => PageData.fromJson(
      await ref
          .read(apiProvider)
          .get(
            '/care-sessions/${widget.sessionId}/notes',
            query: {'page': page, 'size': 20},
          ),
      SessionNote.fromJson,
    ),
    builder: (data, reload) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (data.items.isEmpty) const EmptyState(),
        for (final note in data.items)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (note.createdAt != null)
                  Text(
                    dateLabel(context, note.createdAt!, time: true),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: 6),
                Text(note.content),
                for (final (key, value) in note.vitals)
                  Text('${context.t(key)}: $value'),
                const Divider(),
              ],
            ),
          ),
        Pager(data, (p) => setState(() => page = p)),
      ],
    ),
  );
}

class AddNotePage extends ConsumerStatefulWidget {
  const AddNotePage({super.key, required this.sessionId});
  final String sessionId;
  @override
  ConsumerState<AddNotePage> createState() => _AddNotePageState();
}

class _AddNotePageState extends ConsumerState<AddNotePage> {
  final form = GlobalKey<FormState>(), content = TextEditingController();
  final vitals = {
    for (final key in [
      'systolic',
      'diastolic',
      'heartRate',
      'temperature',
      'spo2',
      'bloodGlucose',
    ])
      key: TextEditingController(),
  };
  bool dirty = false, busy = false;
  @override
  void dispose() {
    content.dispose();
    for (final c in vitals.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => UnsavedGuard(
    dirty: dirty || busy,
    child: Scaffold(
      appBar: AppBar(title: Text(context.t('addNote'))),
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
                'content',
                content,
                required: true,
                maxLength: 2000,
                lines: 4,
                enabled: !busy,
              ),
              Text(
                context.t('vitals'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              for (final entry in vitals.entries)
                Field(
                  entry.key,
                  entry.value,
                  enabled: !busy,
                  keyboard: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    final n = num.tryParse(v.replaceAll(',', '.'));
                    final integral = [
                      'systolic',
                      'diastolic',
                      'heartRate',
                      'spo2',
                    ].contains(entry.key);
                    if (n == null ||
                        !n.isFinite ||
                        (integral && n != n.round()) ||
                        (entry.key == 'temperature'
                            ? n < 30 || n > 45
                            : entry.key == 'spo2'
                            ? n < 0 || n > 100
                            : entry.key == 'bloodGlucose'
                            ? n < 0
                            : n <= 0)) {
                      return context.t('invalidNumber');
                    }
                    return null;
                  },
                ),
              ActionButton(
                label: 'save',
                action: () async {
                  if (!form.currentState!.validate()) return;
                  setState(() => busy = true);
                  try {
                    await ref
                        .read(apiProvider)
                        .post(
                          '/care-sessions/${widget.sessionId}/notes',
                          data: {
                            'content': content.text.trim(),
                            'vitals': {
                              for (final entry in vitals.entries)
                                if (entry.value.text.isNotEmpty)
                                  entry.key: num.parse(
                                    entry.value.text.replaceAll(',', '.'),
                                  ),
                            },
                          },
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
