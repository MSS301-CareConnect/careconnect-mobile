import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/core/auth.dart';

class MemoryTokens implements TokenStore {
  String? token;
  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String? value) async {
    token = value;
  }
}

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.respond);
  final FutureOr<ResponseBody> Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => respond(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody body(Object? result, [int status = 200, int code = 200]) =>
    ResponseBody.fromString(
      jsonEncode({'code': code, 'result': result}),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

void main() {
  test('non-JSON gateway 401 still refreshes authentication', () async {
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          if (o.path.endsWith('/auth/refresh')) {
            return body({'accessToken': 'new', 'refreshToken': 'rotated'});
          }
          if (o.headers['Authorization'] == 'Bearer old') {
            return ResponseBody.fromString('Unauthorized', 401);
          }
          return body({'ok': true});
        }),
      store: MemoryTokens(),
    );
    await api.acceptTokens('old', 'refresh');
    expect(await api.get('/test'), {'ok': true});
  });
  test('role revoked on resume removes the authenticated user', () async {
    var role = 'CAREGIVER';
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter(
          (o) => o.path.endsWith('/login')
              ? body({'accessToken': 'a', 'refreshToken': 'r'})
              : body({
                  'id': 'u',
                  'status': 'ACTIVE',
                  'roles': [role],
                }),
        ),
      store: MemoryTokens(),
    );
    final auth = AuthController(api);
    await auth.login('a@b.vn', 'secret');
    role = 'CUSTOMER';
    await expectLater(auth.reloadUser(), throwsA(isA<ApiFailure>()));
    expect(auth.user, isNull);
  });
  test(
    'concurrent unauthorized reads rotate once and retry with new access',
    () async {
      final store = MemoryTokens();
      var refreshes = 0;
      final dio = Dio()
        ..httpClientAdapter = FakeAdapter((o) async {
          if (o.path.endsWith('/auth/refresh')) {
            refreshes++;
            await Future<void>.delayed(const Duration(milliseconds: 10));
            expect(o.data, {'refreshToken': 'refresh-1'});
            return body({
              'accessToken': 'access-2',
              'refreshToken': 'refresh-2',
            });
          }
          if (o.headers['Authorization'] == 'Bearer access-1') {
            return body(null, 401, 401);
          }
          expect(o.headers['Authorization'], 'Bearer access-2');
          return body({'value': 42});
        });
      final api = ApiClient(dio: dio, store: store);
      await api.acceptTokens('access-1', 'refresh-1');
      final values = await Future.wait([api.get('/test'), api.get('/test')]);
      expect(values, [
        {'value': 42},
        {'value': 42},
      ]);
      expect(refreshes, 1);
      expect(store.token, 'refresh-2');
    },
  );

  test('invalid refresh clears persisted session', () async {
    final store = MemoryTokens();
    final api = ApiClient(
      dio: Dio()..httpClientAdapter = FakeAdapter((o) => body(null, 401, 401)),
      store: store,
    );
    await api.acceptTokens('a', 'r');
    await expectLater(api.get('/test'), throwsA(isA<ApiFailure>()));
    expect(store.token, isNull);
    expect(api.accessToken, isNull);
  });

  test('refresh network failure preserves token for a later retry', () async {
    final store = MemoryTokens();
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          if (o.path.endsWith('/auth/refresh')) {
            throw DioException(
              requestOptions: o,
              type: DioExceptionType.connectionError,
            );
          }
          return body(null, 401, 401);
        }),
      store: store,
    );
    await api.acceptTokens('a', 'r');
    await expectLater(api.get('/test'), throwsA(isA<ApiFailure>()));
    expect(store.token, 'r');
  });

  test('late response after logout cannot return patient data', () async {
    final gate = Completer<ResponseBody>();
    final api = ApiClient(
      dio: Dio()..httpClientAdapter = FakeAdapter((o) => gate.future),
      store: MemoryTokens(),
    );
    await api.acceptTokens('a', 'r');
    final request = api.get('/test');
    final rejected = expectLater(request, throwsA(isA<ApiFailure>()));
    await Future<void>.delayed(Duration.zero);
    await api.clearSession();
    gate.complete(body({'recipientName': 'Private'}));
    await rejected;
  });

  test('business failure in HTTP 200 is not reported as success', () async {
    final api = ApiClient(
      dio: Dio()..httpClientAdapter = FakeAdapter((o) => body(null, 200, 5900)),
      store: MemoryTokens(),
    );
    await expectLater(
      api.get('/test', authenticated: false),
      throwsA(isA<ApiFailure>().having((e) => e.code, 'code', 5900)),
    );
  });

  test('wrong role login discards issued tokens', () async {
    final store = MemoryTokens();
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter(
          (o) => o.path.endsWith('/login')
              ? body({
                  'accessToken': 'a',
                  'refreshToken': 'r',
                  'authenticated': true,
                })
              : body({
                  'id': 'u',
                  'email': 'a@b.vn',
                  'fullName': 'Customer',
                  'status': 'ACTIVE',
                  'roles': ['CUSTOMER'],
                }),
        ),
      store: store,
    );
    final auth = AuthController(api);
    await expectLater(
      auth.login('a@b.vn', 'secret'),
      throwsA(isA<ApiFailure>()),
    );
    expect(auth.user, isNull);
    expect(store.token, isNull);
  });
}
