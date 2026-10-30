import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/device.dart';
import '../../core/l10n.dart';
import '../../core/widgets.dart';
import 'models.dart';
import 'repository.dart';

class VisitDetailPage extends ConsumerStatefulWidget {
  const VisitDetailPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<VisitDetailPage> createState() => _VisitDetailPageState();
}

class _VisitDetailPageState extends ConsumerState<VisitDetailPage>
    with WidgetsBindingObserver {
  late final Timer timer;
  bool busy = false;
  int revision = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    timer.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !busy) setState(() => revision++);
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
  Widget build(BuildContext context) {
    final repo = VisitRepository(ref.read(apiProvider));
    return Scaffold(
      appBar: AppBar(title: Text(context.t('visitDetail'))),
      body: DataView<Visit>(
        key: ValueKey('${widget.id}:$revision'),
        load: () => repo.get(widget.id),
        builder: (visit, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                visit.recipientName.isEmpty
                    ? context.t('recipient')
                    : visit.recipientName,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '${dateLabel(context, visit.startAt)} · ${clockLabel(visit.startAt)}–${clockLabel(visit.endAt)}',
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: StatusChip(visit.status),
              ),
              const SizedBox(height: 20),
              Panel(
                title: context.t('address'),
                icon: Icons.location_on_outlined,
                child: Text(
                  visit.address.isEmpty ? context.t('unknown') : visit.address,
                ),
              ),
              if (visit.callablePhone != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: ActionButton(
                    label: 'call',
                    icon: Icons.call_outlined,
                    outlined: true,
                    action: () => openPhone(visit.callablePhone!),
                  ),
                ),
              if (visit.services.isNotEmpty)
                Panel(
                  title: context.t('services'),
                  child: Text(visit.services.join('\n')),
                ),
              if (visit.customerNote.isNotEmpty)
                Panel(
                  title: context.t('customerNote'),
                  child: Text(visit.customerNote),
                ),
              Panel(
                title: context.t('health'),
                icon: Icons.health_and_safety_outlined,
                child: visit.recipient != null
                    ? RecipientInfo(visit.recipient!)
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(context.t('snapshotHidden')),
                          for (final (key, value) in visit.specialNotes)
                            InfoLine(key, value),
                        ],
                      ),
              ),
              if (visit.noShowReported)
                Panel(
                  title: context.t('noShow'),
                  child: Text(context.t('noShowPending')),
                ),
              if (visit.waiting)
                Panel(
                  title: context.t('session'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (visit.status == 'SCHEDULED') ...[
                        ActionButton(
                          label: 'acknowledge',
                          enabled: !busy,
                          outlined: true,
                          action: () =>
                              mutate(() => repo.acknowledge(visit.id), reload),
                        ),
                        const SizedBox(height: 12),
                      ],
                      ActionButton(
                        label: 'checkIn',
                        icon: Icons.login,
                        enabled: !busy && visit.canCheckIn(DateTime.now()),
                        action: () => mutate(
                          () async => repo.checkIn(
                            visit.id,
                            await optionalCoordinates(),
                          ),
                          reload,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          context.t('checkInHint'),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      if (!DateTime.now().isBefore(visit.startAt))
                        ActionButton(
                          label: 'noShow',
                          enabled: !busy,
                          outlined: true,
                          action: () async {
                            final reason = await askText(
                              context,
                              'reason',
                              minLength: 10,
                              maxLength: 1000,
                            );
                            if (reason != null) {
                              await mutate(
                                () => repo.noShow(visit.id, reason),
                                reload,
                              );
                            }
                          },
                        ),
                    ],
                  ),
                ),
              if (visit.sessionId != null) ...[
                ActionButton(
                  label: 'session',
                  icon: Icons.checklist,
                  action: () async {
                    await context.push('/sessions/${visit.sessionId}');
                    if (mounted) reload();
                  },
                ),
                const SizedBox(height: 12),
                ActionButton(
                  label: 'report',
                  outlined: true,
                  icon: Icons.description_outlined,
                  action: () async {
                    await context.push(
                      '/reports/${visit.sessionId}?bookingId=${visit.bookingId}',
                    );
                    if (mounted) reload();
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

class InfoLine extends StatelessWidget {
  const InfoLine(this.label, this.value, {super.key});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.t(label), style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 4),
        Text(value),
      ],
    ),
  );
}

class RecipientInfo extends StatelessWidget {
  const RecipientInfo(this.recipient, {super.key});
  final RecipientSnapshot recipient;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (recipient.age != null) InfoLine('age', '${recipient.age}'),
      for (final (key, value) in recipient.info) InfoLine(key, value),
      if (recipient.medications.isNotEmpty)
        InfoLine('medications', recipient.medications.join('\n\n')),
      if (recipient.emergencyName.isNotEmpty ||
          recipient.emergencyPhone.isNotEmpty) ...[
        InfoLine(
          'emergency',
          '${recipient.emergencyName}\n${recipient.emergencyPhone}',
        ),
        if (callableNumber(recipient.emergencyPhone) != null)
          ActionButton(
            label: 'call',
            outlined: true,
            action: () => openPhone(callableNumber(recipient.emergencyPhone)!),
          ),
      ],
    ],
  );
}
