import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/widgets.dart';
import '../profile/models.dart';
import 'models.dart';

class AvailabilityPage extends ConsumerStatefulWidget {
  const AvailabilityPage({super.key});
  @override
  ConsumerState<AvailabilityPage> createState() => _AvailabilityPageState();
}

class _AvailabilityPageState extends ConsumerState<AvailabilityPage> {
  int page = 0, revision = 0;
  bool busy = false;
  Future<(CaregiverProfile, PageData<AvailabilitySchedule>, List<TimeOff>)>
  load() async {
    final api = ref.read(apiProvider);
    final profile = CaregiverProfile.fromJson(
      object(await api.get('/caregivers/me')),
    );
    final schedules = PageData.fromJson(
      await api.get(
        '/caregivers/me/schedules',
        query: {'page': page, 'size': 20},
      ),
      AvailabilitySchedule.fromJson,
    );
    final timeOffs = array(
      await api.get(
        '/caregivers/${profile.id}/time-offs',
        query: {'from': DateTime.now().toUtc().toIso8601String()},
      ),
    ).map((v) => TimeOff.fromJson(object(v))).toList();
    return (profile, schedules, timeOffs);
  }

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
  Widget build(
    BuildContext context,
  ) => DataView<(CaregiverProfile, PageData<AvailabilitySchedule>, List<TimeOff>)>(
    key: ValueKey('$page:$revision'),
    load: load,
    builder: (data, reload) => RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(context.t('availabilityIntro')),
          const SizedBox(height: 20),
          Panel(
            title: context.t('availability'),
            icon: Icons.event_available_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data.$2.items.isEmpty) const EmptyState(),
                for (final schedule in data.$2.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${schedule.date} · ${schedule.startTime}–${schedule.endTime}',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: 8),
                        StatusChip(schedule.status),
                        if (schedule.note.isNotEmpty) Text(schedule.note),
                        if (schedule.reason.isNotEmpty) Text(schedule.reason),
                        if (schedule.status == 'SCHEDULED')
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: ActionButton(
                              label: 'cancelSchedule',
                              outlined: true,
                              enabled: !busy,
                              action: () async {
                                final reason = await askText(context, 'reason');
                                if (reason == null) return;
                                await mutate(() async {
                                  await ref
                                      .read(apiProvider)
                                      .request(
                                        'PATCH',
                                        '/caregivers/schedules/${schedule.id}/status',
                                        data: {
                                          'status': 'CANCELLED',
                                          'reason': reason,
                                          'version': schedule.version,
                                        },
                                      );
                                }, reload);
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                Pager(data.$2, (p) => setState(() => page = p)),
              ],
            ),
          ),
          Panel(
            title: context.t('timeOff'),
            icon: Icons.beach_access_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data.$3.isEmpty) const EmptyState(),
                for (final off in data.$3)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${dateLabel(context, off.start, time: true)}\n${dateLabel(context, off.end, time: true)}',
                        ),
                        if (off.reason.isNotEmpty) Text(off.reason),
                        ActionButton(
                          label: 'remove',
                          enabled: !busy,
                          outlined: true,
                          action: () async {
                            if (!await confirm(context, 'deleteConfirm')) {
                              return;
                            }
                            await mutate(() async {
                              await ref
                                  .read(apiProvider)
                                  .request(
                                    'DELETE',
                                    '/caregivers/${data.$1.id}/time-offs/${off.id}',
                                  );
                            }, reload);
                          },
                        ),
                      ],
                    ),
                  ),
                ActionButton(
                  label: 'addTimeOff',
                  enabled: !busy,
                  icon: Icons.add,
                  action: () async {
                    final saved = await showDialog<bool>(
                      context: context,
                      barrierDismissible: false,
                      builder: (_) => TimeOffDialog(
                        onSave: (value) async {
                          await ref
                              .read(apiProvider)
                              .post(
                                '/caregivers/${data.$1.id}/time-offs',
                                data: {
                                  'startAt': value.start
                                      .toUtc()
                                      .toIso8601String(),
                                  'endAt': value.end.toUtc().toIso8601String(),
                                  'reason': value.reason,
                                },
                              );
                        },
                      ),
                    );
                    if (saved == true) await reload();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class TimeOffInput {
  TimeOffInput(this.start, this.end, this.reason);
  final DateTime start, end;
  final String reason;
}

class TimeOffDialog extends StatefulWidget {
  const TimeOffDialog({super.key, required this.onSave});
  final Future<void> Function(TimeOffInput value) onSave;
  @override
  State<TimeOffDialog> createState() => _TimeOffDialogState();
}

class _TimeOffDialogState extends State<TimeOffDialog> {
  DateTime? start, end;
  final reason = TextEditingController();
  String? error;
  bool busy = false;
  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  Future<DateTime?> choose(DateTime? initial) async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
      initialDate: initial ?? now,
    );
    if (day == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial ?? now),
    );
    if (time == null) return null;
    return DateTime(day.year, day.month, day.day, time.hour, time.minute);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      title: Text(context.t('addTimeOff')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OutlinedButton(
              onPressed: busy
                  ? null
                  : () async {
                      final v = await choose(start);
                      if (v != null && mounted) setState(() => start = v);
                    },
              child: Text(
                start == null
                    ? context.t('start')
                    : dateLabel(context, start!, time: true),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: busy
                  ? null
                  : () async {
                      final v = await choose(end);
                      if (v != null && mounted) setState(() => end = v);
                    },
              child: Text(
                end == null
                    ? context.t('end')
                    : dateLabel(context, end!, time: true),
              ),
            ),
            const SizedBox(height: 16),
            Field('reason', reason, maxLength: 500, lines: 2, enabled: !busy),
            if (error != null) Text(context.t(error!)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context),
          child: Text(context.t('cancel')),
        ),
        ActionButton(
          label: 'save',
          enabled: !busy,
          action: () async {
            if (start == null || end == null || !end!.isAfter(start!)) {
              setState(() => error = 'invalidInterval');
              return;
            }
            setState(() => busy = true);
            try {
              await widget.onSave(
                TimeOffInput(start!, end!, reason.text.trim()),
              );
              if (context.mounted) Navigator.pop(context, true);
            } finally {
              if (mounted) setState(() => busy = false);
            }
          },
        ),
      ],
    ),
  );
}
