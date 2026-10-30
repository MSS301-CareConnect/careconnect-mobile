import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/core/auth.dart';
import 'package:careconnect_mobile/features/work_shifts/work_shifts_page.dart';
import '../core/api_client_test.dart' show FakeAdapter, MemoryTokens, body;

void main() {
  testWidgets(
    'deleted historical shift does not hide available registrations',
    (tester) async {
      final api = ApiClient(
        dio: Dio()
          ..httpClientAdapter = FakeAdapter((o) {
            if (o.path.endsWith('/caregivers/me')) {
              return body({'id': 'cg', 'centerId': 'center'});
            }
            if (o.path.endsWith('/registrations/me')) {
              return body({
                'items': [
                  {
                    'id': 'r',
                    'workShiftId': 'deleted',
                    'registrationStatus': 'CANCELLED',
                    'version': 1,
                  },
                ],
                'page': 0,
                'totalPages': 1,
                'totalElements': 1,
              });
            }
            if (o.path.endsWith('/work-shifts/deleted')) {
              return body(null, 404, 4400);
            }
            return body({
              'items': [
                {
                  'id': 'open',
                  'workDate': '2099-10-30',
                  'startTime': '10:00:00',
                  'endTime': '12:00:00',
                  'shiftStatus': 'OPEN',
                  'capacity': 5,
                  'approvedCount': 1,
                },
              ],
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
            home: Scaffold(body: WorkShiftsPage()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Đăng ký ca'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
