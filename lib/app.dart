import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/auth.dart';
import 'core/l10n.dart';
import 'core/shell.dart';
import 'core/theme.dart';
import 'core/widgets.dart';
import 'features/auth/login_page.dart';
import 'features/visits/visits_page.dart';
import 'features/visits/visit_detail_page.dart';
import 'features/sessions/session_page.dart';
import 'features/reports/report_page.dart';
import 'features/availability/availability_page.dart';
import 'features/work_shifts/work_shifts_page.dart';
import 'features/profile/profile_page.dart';
import 'features/profile/account_page.dart';
import 'features/notifications/notifications_page.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  final router = GoRouter(
    initialLocation: '/visits',
    refreshListenable: auth,
    redirect: (context, state) {
      final path = state.uri.path;
      if (auth.restoring || auth.restoreError != null) {
        return path == '/startup' ? null : '/startup';
      }
      final public = path == '/login' || path == '/recovery';
      if (auth.user == null) return public ? null : '/login';
      if (public || path == '/startup') return '/visits';
      return null;
    },
    routes: [
      GoRoute(
        path: '/startup',
        builder: (c, s) => Scaffold(
          body: Center(
            child: auth.restoreError != null
                ? ErrorPanel(error: auth.restoreError!, retry: auth.restore)
                : const CircularProgressIndicator(),
          ),
        ),
      ),
      GoRoute(path: '/login', builder: (c, s) => const LoginPage()),
      GoRoute(path: '/recovery', builder: (c, s) => const RecoveryPage()),
      ShellRoute(
        builder: (c, s, child) => CareShell(
          key: ValueKey('${auth.user?.id}:${auth.api.epoch}'),
          location: s.uri.path,
          child: child,
        ),
        routes: [
          GoRoute(path: '/visits', builder: (c, s) => const VisitsPage()),
          GoRoute(
            path: '/availability',
            builder: (c, s) => const AvailabilityPage(),
          ),
          GoRoute(
            path: '/work-shifts',
            builder: (c, s) => const WorkShiftsPage(),
          ),
          GoRoute(path: '/profile', builder: (c, s) => const ProfilePage()),
        ],
      ),
      GoRoute(
        path: '/visits/:id',
        builder: (c, s) => VisitDetailPage(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/sessions/:id',
        builder: (c, s) => SessionPage(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/sessions/:id/notes/new',
        builder: (c, s) => AddNotePage(sessionId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/reports/:id',
        redirect: (c, s) =>
            s.uri.queryParameters['bookingId'] == null ? '/visits' : null,
        builder: (c, s) => ReportPage(
          sessionId: s.pathParameters['id']!,
          bookingId: s.uri.queryParameters['bookingId']!,
        ),
      ),
      GoRoute(
        path: '/profile/certificates/new',
        redirect: (c, s) =>
            s.uri.queryParameters['caregiverId'] == null ? '/profile' : null,
        builder: (c, s) => AddCertificatePage(
          caregiverId: s.uri.queryParameters['caregiverId']!,
        ),
      ),
      GoRoute(path: '/account', builder: (c, s) => const AccountPage()),
      GoRoute(
        path: '/password',
        builder: (c, s) => const AccountPage(passwordOnly: true),
      ),
      GoRoute(
        path: '/notifications',
        builder: (c, s) => const NotificationsPage(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

class CareConnectApp extends ConsumerStatefulWidget {
  const CareConnectApp({super.key});
  @override
  ConsumerState<CareConnectApp> createState() => _CareConnectAppState();
}

class _CareConnectAppState extends ConsumerState<CareConnectApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authProvider).restore());
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'CareConnect',
    debugShowCheckedModeBanner: false,
    theme: careTheme(),
    locale: ref.watch(localeProvider),
    supportedLocales: const [Locale('vi'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    routerConfig: ref.watch(routerProvider),
  );
}
