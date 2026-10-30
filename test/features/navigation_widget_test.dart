import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:careconnect_mobile/app.dart';
import 'package:careconnect_mobile/core/auth.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import '../core/api_client_test.dart' show FakeAdapter, MemoryTokens, body;

void main() {
  testWidgets(
    'active caregiver navigates the four live API tabs and notifications',
    (tester) async {
      tester.view.physicalSize = const Size(640, 960);
      tester.view.devicePixelRatio = 2;
      tester.platformDispatcher.textScaleFactorTestValue = 1.5;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final readPaths = <String>[];
      final api = ApiClient(
        dio: Dio()
          ..httpClientAdapter = FakeAdapter((o) {
            readPaths.add(o.path);
            if (o.path.endsWith('/auth/refresh')) {
              return body({'accessToken': 'a', 'refreshToken': 'r2'});
            }
            if (o.path.endsWith('/users/me')) {
              return body({
                'id': 'u',
                'email': 'care@example.vn',
                'fullName': 'Nguyễn An',
                'status': 'ACTIVE',
                'roles': ['CAREGIVER'],
              });
            }
            if (o.path.endsWith('/caregivers/me')) {
              return body({
                'id': 'cg',
                'centerId': 'center',
                'fullName': 'Nguyễn An',
                'centerName': 'Care Center',
                'caregiverStatus': 'ACTIVE',
                'verificationStatus': 'VERIFIED',
                'experienceYears': 3,
              });
            }
            if (o.path.endsWith('/unread-count')) return body({'count': 0});
            if (o.path.contains('/services') ||
                o.path.contains('/certificates/') ||
                o.path.contains('/provider-media/') ||
                o.path.contains('/time-offs')) {
              return body([]);
            }
            return body({
              'items': [],
              'page': 0,
              'size': 20,
              'totalPages': 0,
              'totalElements': 0,
            });
          }),
        store: MemoryTokens()..token = 'r1',
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiProvider.overrideWithValue(api)],
          child: const CareConnectApp(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Nguyễn An'), findsOneWidget);
      await tester.drag(find.byType(ListView).first, const Offset(0, -500));
      await tester.pumpAndSettle();
      expect(readPaths, contains('/api/v1/booking-occurrences'));
      for (final (icon, path) in [
        (Icons.calendar_month_outlined, '/api/v1/caregivers/me/schedules'),
        (Icons.event_available_outlined, '/api/v1/work-shifts'),
        (Icons.person_outline, '/api/v1/caregivers/me'),
      ]) {
        await tester.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.byIcon(icon),
          ),
        );
        await tester.pumpAndSettle();
        expect(readPaths, contains(path));
        expect(tester.takeException(), isNull);
      }
      await tester.tap(find.byTooltip('Thông báo'));
      await tester.pumpAndSettle();
      expect(readPaths, contains('/api/v1/notifications'));
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
