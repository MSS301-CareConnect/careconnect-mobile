import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth.dart';
import '../../core/json.dart';
import '../../core/l10n.dart';
import '../../core/widgets.dart';
import 'models.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});
  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  int page = 0;
  bool unread = false, busy = false;
  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.t('notifications'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: FilterChip(
                label: Text(context.t('unread')),
                selected: unread,
                onSelected: (v) => setState(() {
                  unread = v;
                  page = 0;
                }),
              ),
            ),
          ),
          Expanded(
            child: DataView<PageData<AppNotification>>(
              key: ValueKey('$page:$unread'),
              load: () async => PageData.fromJson(
                await api.get(
                  '/notifications',
                  query: {'page': page, 'size': 20, 'unreadOnly': unread},
                ),
                AppNotification.fromJson,
              ),
              builder: (data, reload) => RefreshIndicator(
                onRefresh: reload,
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    ActionButton(
                      label: 'readAll',
                      outlined: true,
                      enabled: !busy,
                      action: () async {
                        setState(() => busy = true);
                        try {
                          await api.request('PATCH', '/notifications/read-all');
                          await reload();
                        } finally {
                          if (mounted) setState(() => busy = false);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    if (data.items.isEmpty) const EmptyState(),
                    for (final n in data.items)
                      Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: Icon(
                            n.read
                                ? Icons.notifications_none
                                : Icons.notifications_active_outlined,
                          ),
                          title: Text(
                            n.title,
                            style: TextStyle(
                              fontWeight: n.read
                                  ? FontWeight.normal
                                  : FontWeight.bold,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 8),
                              Text(n.body),
                              if (n.createdAt != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    dateLabel(
                                      context,
                                      n.createdAt!,
                                      time: true,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          onTap: busy
                              ? null
                              : () async {
                                  setState(() => busy = true);
                                  try {
                                    if (!n.read) {
                                      await api.request(
                                        'PATCH',
                                        '/notifications/${n.id}/read',
                                      );
                                    }
                                    if (!context.mounted) return;
                                    if (n.target != null) {
                                      await context.push(n.target!);
                                    }
                                    if (mounted) await reload();
                                  } catch (e) {
                                    if (context.mounted) showError(context, e);
                                  } finally {
                                    if (mounted) setState(() => busy = false);
                                  }
                                },
                        ),
                      ),
                    Pager(data, (p) => setState(() => page = p)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
