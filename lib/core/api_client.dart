import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'json.dart';
import 'token_store.dart';

class ApiFailure implements Exception {
  const ApiFailure(this.kind, {this.status, this.code});
  final String kind;
  final int? status, code;
  @override
  String toString() => 'ApiFailure($kind, $status, $code)';
}

class ApiClient {
  ApiClient({Dio? dio, required this.store})
    : dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: const String.fromEnvironment(
                'API_BASE_URL',
                defaultValue: 'http://10.0.2.2:8080',
              ),
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              sendTimeout: const Duration(seconds: 45),
            ),
          );
  final Dio dio;
  final TokenStore store;
  String? accessToken;
  String? _refreshToken;
  int _epoch = 0;
  int get epoch => _epoch;
  VoidCallback? onExpired;
  Future<void>? _refreshing;
  Future<void> _storeQueue = Future.value();

  Future<void> _persist(String? value) {
    final write = _storeQueue.then((_) => store.write(value));
    _storeQueue = write.catchError((Object _) {});
    return write;
  }

  Future<void> acceptTokens(String access, String refresh) async {
    _epoch++;
    accessToken = access;
    _refreshToken = refresh;
    await _persist(refresh);
  }

  Future<void> clearSession() async {
    _epoch++;
    accessToken = null;
    _refreshToken = null;
    await _persist(null);
  }

  Future<bool> restore() async {
    final captured = _epoch;
    final stored = await store.read();
    if (captured != _epoch || stored == null) return false;
    _refreshToken = stored;
    await refresh();
    return accessToken != null;
  }

  Future<void> refresh() {
    if (_refreshing != null) return _refreshing!;
    final pending = _rotate();
    _refreshing = pending;
    return pending.whenComplete(() {
      if (identical(_refreshing, pending)) _refreshing = null;
    });
  }

  Future<void> _rotate() async {
    final captured = _epoch;
    final token = _refreshToken;
    if (token == null) throw const ApiFailure('expired', status: 401);
    try {
      final result = object(
        await request(
          'POST',
          '/auth/refresh',
          data: {'refreshToken': token},
          authenticated: false,
        ),
      );
      if (captured != _epoch) throw const ApiFailure('expired', status: 401);
      final access = string(result['accessToken']);
      final refreshToken = string(result['refreshToken']);
      if (access.isEmpty || refreshToken.isEmpty) {
        throw const ApiFailure('invalidResponse');
      }
      accessToken = access;
      _refreshToken = refreshToken;
      await _persist(refreshToken);
    } on ApiFailure catch (e) {
      if (captured == _epoch && (e.status == 401 || e.status == 403)) {
        await expire();
      }
      rethrow;
    }
  }

  Future<void> expire() async {
    await clearSession();
    onExpired?.call();
  }

  Future<Object?> get(String path, {Json? query, bool authenticated = true}) =>
      request('GET', path, query: query, authenticated: authenticated);
  Future<Object?> post(
    String path, {
    Object? data,
    bool authenticated = true,
  }) => request('POST', path, data: data, authenticated: authenticated);

  Future<Object?> request(
    String method,
    String path, {
    Object? data,
    Json? query,
    bool authenticated = true,
  }) async {
    final captured = _epoch;
    final sentToken = accessToken;
    Future<Object?> send(String? token) async {
      try {
        final response = await dio.request<Object?>(
          '/api/v1$path',
          data: data is FormData ? data.clone() : data,
          queryParameters: query,
          options: Options(
            method: method,
            headers: {
              if (token != null) 'Authorization': 'Bearer $token',
              'X-Client-Type': 'mobile',
            },
            validateStatus: (_) => true,
          ),
        );
        if (authenticated && captured != _epoch) {
          throw const ApiFailure('expired', status: 401);
        }
        final status = response.statusCode ?? 0;
        if (response.data is! Map && (status < 200 || status >= 300)) {
          throw ApiFailure('server', status: status);
        }
        final envelope = object(response.data);
        final code = integer(envelope['code']);
        if (status < 200 || status >= 300 || code != 200) {
          throw ApiFailure('server', status: status, code: code);
        }
        return envelope['result'];
      } on DioException catch (e) {
        throw ApiFailure(
          e.type == DioExceptionType.badCertificate ? 'certificate' : 'network',
        );
      } on FormatException {
        throw const ApiFailure('invalidResponse');
      } on TypeError {
        throw const ApiFailure('invalidResponse');
      }
    }

    try {
      return await send(authenticated ? sentToken : null);
    } on ApiFailure catch (failure) {
      if (!authenticated || failure.status != 401 || captured != _epoch) {
        rethrow;
      }
      if (accessToken == sentToken) await refresh();
      if (captured != _epoch) throw const ApiFailure('expired', status: 401);
      try {
        return await send(accessToken);
      } on ApiFailure catch (retryFailure) {
        if (retryFailure.status == 401 && captured == _epoch) await expire();
        rethrow;
      }
    }
  }

  Future<bool> logout() async {
    final refreshToken = _refreshToken;
    final access = accessToken;
    await clearSession();
    try {
      final response = await dio.post<Object?>(
        '/api/v1/auth/logout',
        data: {'refreshToken': refreshToken},
        options: Options(
          headers: {
            'X-Client-Type': 'mobile',
            if (access != null) 'Authorization': 'Bearer $access',
          },
        ),
      );
      return integer(object(response.data)['code']) == 200;
    } catch (_) {
      return false;
    }
  }

  Future<List<T>> allPages<T>(
    String path,
    T Function(Json) decode, {
    Json query = const {},
  }) async {
    final items = <T>[];
    for (var page = 0; ; page++) {
      final result = PageData.fromJson(
        await get(path, query: {...query, 'page': page, 'size': 50}),
        decode,
      );
      items.addAll(result.items);
      if (!result.hasNext) return items;
      if (page >= 999) throw const ApiFailure('tooManyPages');
    }
  }
}
