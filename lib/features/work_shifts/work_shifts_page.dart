import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth.dart';
import '../../core/api_client.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/widgets.dart';
import '../profile/models.dart';
import 'models.dart';

class ShiftData {
  ShiftData(this.shifts, this.registrations, this.registeredShifts);
  final PageData<WorkShift> shifts;
  final List<ShiftRegistration> registrations;
  final Map<String, WorkShift> registeredShifts;
}

class WorkShiftsPage extends ConsumerStatefulWidget {
  const WorkShiftsPage({super.key});
  @override
  ConsumerState<WorkShiftsPage> createState() => _WorkShiftsPageState();
}

class _WorkShiftsPageState extends ConsumerState<WorkShiftsPage> {
  int page = 0, registrationsPage = 0;
  bool registrationsTab = false, busy = false;
  late final Timer timer = Timer.periodic(const Duration(seconds: 30), (_) {
    if (mounted) setState(() {});
  });
  @override
  void initState() {
    super.initState();
    timer;
  }

  @override
  void dispose() {
    timer.cancel();
    super.dispose();
  }

  Future<ShiftData> load() async {
    final api = ref.read(apiProvider);
    final profile = CaregiverProfile.fromJson(
      object(await api.get('/caregivers/me')),
    );
    final shifts = PageData.fromJson(
      await api.get(
        '/work-shifts',
        query: {
          'centerId': profile.centerId,
          'status': 'OPEN',
          'page': page,
          'size': 20,
          'fromDate': localDay(
            DateTime.now().toUtc().add(const Duration(hours: 7)),
          ),
        },
      ),
      WorkShift.fromJson,
    );
    final registrations = await api.allPages(
      '/work-shifts/registrations/me',
      ShiftRegistration.fromJson,
    );
    final shown = registrations.skip(registrationsPage * 20).take(20);
    final registeredShifts = await Future.wait(
      shown.map((r) async {
        try {
          return WorkShift.fromJson(
            object(await api.get('/work-shifts/${r.shiftId}')),
          );
        } on ApiFailure catch (e) {
          if (e.status == 404) return null;
          rethrow;
        }
      }),
    );
    return ShiftData(shifts, registrations, {
      for (final s in registeredShifts.whereType<WorkShift>()) s.id: s,
    });
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
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: Text(context.t('openShifts')),
              selected: !registrationsTab,
              onSelected: (_) => setState(() => registrationsTab = false),
            ),
            ChoiceChip(
              label: Text(context.t('myRegistrations')),
              selected: registrationsTab,
              onSelected: (_) => setState(() => registrationsTab = true),
            ),
          ],
        ),
      ),
      Expanded(
        child: DataView<ShiftData>(
          key: ValueKey('$page:$registrationsPage'),
          load: load,
          builder: (data, reload) => RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (!registrationsTab) ...[
                  if (data.shifts.items.isEmpty) const EmptyState(),
                  for (final shift in data.shifts.items)
                    Panel(
                      title: shift.date,
                      icon: Icons.event_outlined,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ShiftInfo(shift),
                          const SizedBox(height: 16),
                          if (data.registrations.any(
                            (r) => r.shiftId == shift.id && r.active,
                          ))
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(context.t('registered')),
                            )
                          else
                            ActionButton(
                              label:
                                  shift.canRegister(
                                    DateTime.now(),
                                    data.registrations,
                                  )
                                  ? 'registerShift'
                                  : 'closed',
                              enabled:
                                  !busy &&
                                  shift.canRegister(
                                    DateTime.now(),
                                    data.registrations,
                                  ),
                              action: () async {
                                final note = await askText(
                                  context,
                                  'registrationNote',
                                  optional: true,
                                );
                                if (note == null) return;
                                await mutate(() async {
                                  await ref
                                      .read(apiProvider)
                                      .post(
                                        '/work-shifts/${shift.id}/registrations',
                                        data: {'caregiverNote': note},
                                      );
                                }, reload);
                              },
                            ),
                        ],
                      ),
                    ),
                  Pager(data.shifts, (p) => setState(() => page = p)),
                ] else ...[
                  if (data.registrations.isEmpty) const EmptyState(),
                  for (final r
                      in data.registrations
                          .skip(registrationsPage * 20)
                          .take(20))
                    Panel(
                      title:
                          data.registeredShifts[r.shiftId]?.date ??
                          context.t('shifts'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (data.registeredShifts[r.shiftId] != null)
                            ShiftInfo(data.registeredShifts[r.shiftId]!),
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: StatusChip(r.status),
                          ),
                          if (r.note.isNotEmpty) Text(r.note),
                          if (r.reason.isNotEmpty) Text(r.reason),
                          if (r.canCancel) ...[
                            const SizedBox(height: 12),
                            ActionButton(
                              label: 'cancelRegistration',
                              outlined: true,
                              enabled: !busy,
                              action: () async {
                                if (!await confirm(context, 'deleteConfirm')) {
                                  return;
                                }
                                await mutate(() async {
                                  await ref
                                      .read(apiProvider)
                                      .request(
                                        'DELETE',
                                        '/work-shifts/registrations/${r.id}',
                                        query: r.cancelQuery,
                                      );
                                }, reload);
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  Pager(
                    PageData(
                      data.registrations,
                      registrationsPage,
                      (data.registrations.length / 20).ceil(),
                      data.registrations.length,
                    ),
                    (p) => setState(() => registrationsPage = p),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

class ShiftInfo extends StatelessWidget {
  const ShiftInfo(this.shift, {super.key});
  final WorkShift shift;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${shift.startTime} – ${shift.endTime}',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 8),
      if (shift.centerName.isNotEmpty) Text(shift.centerName),
      Text('${context.t('capacity')}: ${shift.approved}/${shift.capacity}'),
      if (shift.deadline != null)
        Text(
          '${context.t('deadline')}: ${dateLabel(context, shift.deadline!, time: true)}',
        ),
      if (shift.note.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(shift.note),
        ),
    ],
  );
}
