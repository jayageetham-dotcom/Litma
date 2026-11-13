import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'auth.dart';

class AccountException implements Exception {
  const AccountException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// The writer's own account on the server (litma-account Edge Function): Settings → Delete account,
/// which the App Store and Google Play ask apps to offer inside the app.
class AccountApi {
  AccountApi(this.auth, {http.Client? client}) : _client = client ?? http.Client();
  final AuthGateway auth;
  final http.Client _client;

  /// Deletes the account and everything in it for good.
  Future<void> delete() async {
    final token = await auth.accessToken();
    if (token == null) throw const AccountException('Sign in first.');
    final r = await _client
        .post(
          Uri.parse('${AppConfig.functionsUrl}/litma-account'),
          headers: {'content-type': 'application/json', 'authorization': 'Bearer $token', 'apikey': AppConfig.supabaseAnonKey},
          body: jsonEncode({'op': 'delete', 'confirm': 'DELETE'}),
        )
        .timeout(const Duration(seconds: 30));
    if (r.statusCode != 200) throw AccountException(r.body);
  }
}
