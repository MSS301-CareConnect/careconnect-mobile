import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'auth.dart';
import 'json.dart';
import 'l10n.dart';

class CareShell extends ConsumerStatefulWidget {
  const CareShell({super.key, required this.child, required this.location});
  final Widget child;
  final String location;
  @override
  ConsumerState<CareShell> createState() => _CareShellState();
}

class _CareShellState extends ConsumerState<CareShell>
    with WidgetsBindingObserver {
  static const paths = ['/visits', '/availability', '/work-shifts', '/profile'];
  static const labels = ['visits', 'availability', 'shifts', 'profile'];
  static const icons = [
    Icons.assignment_ind_outlined,
    Icons.calendar_month_outlined,
    Icons.event_available_outlined,
    Icons.person_outline,
  ];
  int unread = 0;
  bool active = true;
  late final Timer timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refreshCount();
    timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (active) refreshCount();
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
    active = state == AppLifecycleState.resumed;
    if (active) {
      refreshCount();
      ref.read(authProvider).reloadUser().catchError((Object _) {});
    }
  }

  Future<void> refreshCount() async {
    try {
      final result = object(
        await ref.read(apiProvider).get('/notifications/unread-count'),
      );
      if (mounted) setState(() => unread = integer(result['count']));
    } catch (_) {
      /* Keep navigation usable while the count is unavailable. */
    }
  }

  @override
  Widget build(BuildContext context) {
    final index = paths.indexOf(widget.location);
    final selected = index < 0 ? 0 : index;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.t(labels[selected])),
        actions: [
          IconButton(
            tooltip: context.t('notifications'),
            onPressed: () async {
              await context.push('/notifications');
              if (mounted) refreshCount();
            },
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(top: false, child: widget.child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        onDestinationSelected: (i) => context.go(paths[i]),
        destinations: [
          for (var i = 0; i < paths.length; i++)
            NavigationDestination(
              icon: Icon(icons[i]),
              label: context.t(labels[i]),
            ),
        ],
      ),
    );
  }
}
