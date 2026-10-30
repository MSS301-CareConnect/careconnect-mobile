import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/core/auth.dart';
import 'package:careconnect_mobile/features/reports/report_page.dart';
import '../core/api_client_test.dart' show FakeAdapter, MemoryTokens, body;

void main() {
  testWidgets('lost submit response becomes read only after explicit retry', (
    tester,
  ) async {
    var submitted = false, updates = 0, submissions = 0;
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          final report = {
            'id': 'r',
            'sessionId': 's',
            'overallCondition': 'STABLE',
            'summary': 'Observed',
            'status': submitted ? 'SUBMITTED' : 'DRAFT',
            'version': 1,
          };
          if (o.path.contains('/care-sessions/')) {
            return body({
              'sessionId': 's',
              'status': 'ENDED',
              'bookingId': 'b',
              'tasks': [],
            });
          }
          if (o.path.endsWith('/submit')) {
            submitted = true;
            submissions++;
            throw DioException(
              requestOptions: o,
              type: DioExceptionType.connectionError,
            );
          }
          if (o.method == 'PUT') {
            updates++;
            return body(report);
          }
          if (o.path.endsWith('/care-reports/r')) return body(report);
          return body({
            'items': [report],
            'page': 0,
            'totalPages': 1,
            'totalElements': 1,
          });
        }),
      store: MemoryTokens(),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          locale: Locale('vi'),
          supportedLocales: [Locale('vi'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: ReportPage(sessionId: 's', bookingId: 'b'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Gửi báo cáo'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lưu nháp'));
    await tester.pumpAndSettle();
    expect(submissions, 1);
    expect(updates, 1);
    expect(find.text('Gửi báo cáo'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'lost draft update response reconciles version on explicit retry',
    (tester) async {
      var version = 1, writes = 0;
      final sentVersions = <Object?>[];
      final api = ApiClient(
        dio: Dio()
          ..httpClientAdapter = FakeAdapter((o) {
            final report = {
              'id': 'r',
              'sessionId': 's',
              'overallCondition': 'STABLE',
              'summary': 'Observed',
              'status': 'DRAFT',
              'version': version,
            };
            if (o.path.contains('/care-sessions/')) {
              return body({
                'sessionId': 's',
                'status': 'ENDED',
                'bookingId': 'b',
                'tasks': [],
              });
            }
            if (o.method == 'PUT') {
              sentVersions.add((o.data as Map)['version']);
              writes++;
              if (writes == 1) {
                version = 2;
                throw DioException(
                  requestOptions: o,
                  type: DioExceptionType.connectionError,
                );
              }
              return body({...report, 'version': 3});
            }
            if (o.path.endsWith('/care-reports/r')) return body(report);
            return body({
              'items': [report],
              'page': 0,
              'size': 20,
              'totalPages': 1,
              'totalElements': 1,
            });
          }),
        store: MemoryTokens(),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiProvider.overrideWithValue(api)],
          child: const MaterialApp(
            locale: Locale('vi'),
            supportedLocales: [Locale('vi'), Locale('en')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: ReportPage(sessionId: 's', bookingId: 'b'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Lưu nháp'),
        500,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Lưu nháp'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu nháp'));
      await tester.pumpAndSettle();
      expect(writes, 2);
      expect(sentVersions, [1, 2]);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('report submission stays disabled until the session is ended', (
    tester,
  ) async {
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          if (o.path.contains('/care-sessions/')) {
            return body({
              'sessionId': 's',
              'status': 'IN_PROGRESS',
              'bookingId': 'b',
              'tasks': [],
            });
          }
          return body({
            'items': [
              {
                'id': 'r',
                'sessionId': 's',
                'overallCondition': 'STABLE',
                'summary': 'Observed',
                'status': 'DRAFT',
                'version': 1,
              },
            ],
            'page': 0,
            'size': 20,
            'totalPages': 1,
            'totalElements': 1,
          });
        }),
      store: MemoryTokens(),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          locale: Locale('vi'),
          supportedLocales: [Locale('vi'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: ReportPage(sessionId: 's', bookingId: 'b'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Gửi báo cáo'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Gửi báo cáo'),
    );
    expect(button.onPressed, isNull);
  });
}
