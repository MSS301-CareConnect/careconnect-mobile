import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'json.dart';
import 'token_store.dart';
export 'token_store.dart';

class AuthUser {
  AuthUser.fromJson(Json j)
    : id = string(j['id']),
      email = string(j['email']),
      fullName = string(j['fullName']),
      phoneNumber = string(j['phoneNumber']),
      status = string(j['status']),
      roles = array(j['roles']).map((e) => string(e)).toSet();
  final String id, email, fullName, phoneNumber, status;
  final Set<String> roles;
  bool get isCaregiver => status == 'ACTIVE' && roles.contains('CAREGIVER');
}

class AuthController extends ChangeNotifier {
  AuthController(this.api) {
    api.onExpired = () {
      user = null;
      notifyListeners();
    };
  }
  final ApiClient api;
  AuthUser? user;
  bool restoring = true;
  Object? restoreError;
  int _operation = 0;
  Future<void> restore() async {
    final operation = ++_operation;
    restoring = true;
    restoreError = null;
    notifyListeners();
    try {
      if (await api.restore()) await _loadUser(operation);
    } on ApiFailure catch (e) {
      if (e.status != 401 && e.status != 403) restoreError = e;
    } catch (_) {
      restoreError = const ApiFailure('storage');
    }
    if (operation == _operation) {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> _loadUser(int operation) async {
    final account = AuthUser.fromJson(object(await api.get('/users/me')));
    if (operation != _operation) return;
    if (!account.isCaregiver) {
      await api.clearSession();
      user = null;
      notifyListeners();
      throw const ApiFailure('caregiverOnly', status: 403);
    }
    user = account;
  }

  Future<void> login(String email, String password) async {
    final operation = ++_operation;
    final session = object(
      await api.post(
        '/auth/login',
        authenticated: false,
        data: {'email': email.trim(), 'password': password},
      ),
    );
    if (operation != _operation) return;
    final access = string(session['accessToken']),
        refresh = string(session['refreshToken']);
    if (access.isEmpty || refresh.isEmpty) {
      throw const ApiFailure('invalidResponse');
    }
    await api.acceptTokens(access, refresh);
    try {
      await _loadUser(operation);
    } catch (_) {
      if (operation == _operation) await api.clearSession();
      rethrow;
    }
    restoring = false;
    notifyListeners();
  }

  Future<void> reloadUser() async {
    await _loadUser(_operation);
    notifyListeners();
  }

  Future<bool> logout() async {
    _operation++;
    user = null;
    restoreError = null;
    restoring = false;
    final result = api.logout();
    notifyListeners();
    return result;
  }
}

final apiProvider = Provider<ApiClient>((ref) {
  final api = ApiClient(store: SecureTokenStore());
  ref.onDispose(() => api.dio.close());
  return api;
});
final authProvider = Provider<AuthController>((ref) {
  final auth = AuthController(ref.watch(apiProvider));
  ref.onDispose(auth.dispose);
  return auth;
});
