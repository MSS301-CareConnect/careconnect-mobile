import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:careconnect_mobile/app.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/core/auth.dart';
import 'core/api_client_test.dart' show MemoryTokens, FakeAdapter, body;
import 'package:dio/dio.dart';

void main() {
  testWidgets('login validates blank credentials without sending request', (
    tester,
  ) async {
    var calls = 0;
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          calls++;
          return body(null);
        }),
      store: MemoryTokens(),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(api)],
        child: const CareConnectApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chào mừng trở lại'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập email hợp lệ.'), findsOneWidget);
    expect(calls, 0);
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(find.text('Vui lòng nhập email hợp lệ.'), findsNothing);
  });
  testWidgets('login remains usable on a small screen with large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(640, 960);
    tester.view.devicePixelRatio = 2;
    tester.platformDispatcher.textScaleFactorTestValue = 1.5;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final api = ApiClient(dio: Dio(), store: MemoryTokens());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiProvider.overrideWithValue(api)],
        child: const CareConnectApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -600),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
