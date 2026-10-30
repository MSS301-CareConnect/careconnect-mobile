import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/l10n.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../core/json.dart';
import 'models.dart';
import 'repository.dart';

class VisitsPage extends ConsumerStatefulWidget {
  const VisitsPage({super.key});
  @override
  ConsumerState<VisitsPage> createState() => _VisitsPageState();
}

class _VisitsPageState extends ConsumerState<VisitsPage>
    with WidgetsBindingObserver {
  DateTime? from = DateTime.now(), to = DateTime.now();
  String? status;
  int page = 0, revision = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) setState(() => revision++);
  }

  @override
  Widget build(BuildContext context) {
    final repository = VisitRepository(ref.read(apiProvider));
    return RefreshIndicator(
      onRefresh: () async {
        setState(() => revision++);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: const Color(0xFF173627),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.t('hello'),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        ref.read(authProvider).user?.fullName ?? '',
                        style: const TextStyle(color: Color(0xFFD8EFCC)),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        context.t('visitsIntro'),
                        style: const TextStyle(color: Color(0xFFC6D7C9)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ActionChip(
                      label: Text(
                        from != null
                            ? '${dateLabel(context, from!)}${to != null && localDay(from!) != localDay(to!) ? ' – ${dateLabel(context, to!)}' : ''}'
                            : context.t('dateRange'),
                      ),
                      avatar: const Icon(
                        Icons.calendar_month_outlined,
                        size: 18,
                      ),
                      onPressed: () async {
                        final now = DateTime.now();
                        final range = await showDateRangePicker(
                          context: context,
                          firstDate: DateTime(now.year - 3),
                          lastDate: DateTime(now.year + 3),
                          initialDateRange: from == null
                              ? null
                              : DateTimeRange(start: from!, end: to ?? from!),
                        );
                        if (range != null && mounted) {
                          setState(() {
                            from = range.start;
                            to = range.end;
                            page = 0;
                          });
                        }
                      },
                    ),
                    ActionChip(
                      label: Text(context.t('today')),
                      onPressed: () => setState(() {
                        from = DateTime.now();
                        to = from;
                        page = 0;
                      }),
                    ),
                    ActionChip(
                      label: Text(context.t('allDates')),
                      onPressed: () => setState(() {
                        from = null;
                        to = null;
                        page = 0;
                      }),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: status ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: context.t('all')),
                  items: [
                    for (final s in [
                      '',
                      'SCHEDULED',
                      'ACKNOWLEDGED',
                      'IN_PROGRESS',
                      'COMPLETED',
                      'MISSED',
                      'CANCELLED',
                      'CUSTOMER_NO_SHOW',
                    ])
                      DropdownMenuItem(
                        value: s,
                        child: Text(context.t(s.isEmpty ? 'all' : s)),
                      ),
                  ],
                  onChanged: (v) => setState(() {
                    status = v == '' ? null : v;
                    page = 0;
                  }),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: DataView<PageData<Visit>>(
              key: ValueKey('$page:$status:$from:$to:$revision'),
              load: () => repository.list(
                page: page,
                from: from,
                to: to,
                status: status,
              ),
              builder: (data, reload) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (data.items.isEmpty) const EmptyState(text: 'noVisits'),
                  for (final visit in data.items)
                    VisitCard(
                      visit,
                      onTap: () async {
                        await context.push('/visits/${visit.id}');
                        if (mounted) reload();
                      },
                    ),
                  Pager(data, (p) => setState(() => page = p)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class VisitCard extends StatelessWidget {
  const VisitCard(this.visit, {super.key, required this.onTap});
  final Visit visit;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  '${clockLabel(visit.startAt)} – ${clockLabel(visit.endAt)}',
                  style: const TextStyle(
                    color: brand,
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                  ),
                ),
                StatusChip(visit.status),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              visit.recipientName.isEmpty
                  ? context.t('recipient')
                  : visit.recipientName,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(dateLabel(context, visit.startAt)),
            if (visit.address.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_on_outlined, size: 18),
                    const SizedBox(width: 6),
                    Expanded(child: Text(visit.address)),
                  ],
                ),
              ),
            if (visit.bookingCode.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '#${visit.bookingCode}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
