import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/features/availability/availability_page.dart';

void main() {
  testWidgets('time off rejection retains entered dates and reason for retry', (
    tester,
  ) async {
    var attempts = 0;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('vi'),
        supportedLocales: const [Locale('vi'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showDialog<bool>(
                context: context,
                builder: (_) => TimeOffDialog(
                  onSave: (value) async {
                    attempts++;
                    throw const ApiFailure('server', status: 409);
                  },
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    for (final (label, day) in [
      ('Bắt đầu', DateTime.now()),
      ('Kết thúc', DateTime.now().add(const Duration(days: 1))),
    ]) {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      tester
          .widget<CalendarDatePicker>(find.byType(CalendarDatePicker))
          .onDateChanged(day);
      await tester.pump();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
    }
    await tester.enterText(find.byType(TextFormField), 'Việc gia đình');
    await tester.tap(find.text('Lưu'));
    await tester.pumpAndSettle();
    expect(attempts, 1);
    expect(find.byType(TimeOffDialog), findsOneWidget);
    expect(find.text('Việc gia đình'), findsOneWidget);
    await tester.tap(find.text('Lưu'));
    await tester.pumpAndSettle();
    expect(attempts, 2);
  });
}
