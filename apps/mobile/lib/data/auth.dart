import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backend.dart';
import 'analytics.dart';

/// The signed-in writer as the app needs it.
@immutable
class Writer {
  const Writer({required this.id, this.email, this.name});
  final String id;
  final String? email;
  final String? name;
}

/// Sign-in for the app. Supabase in the app; a fake in tests and design previews.
abstract class AuthGateway {
  /// null when signed out.
  Writer? get writer;
  Stream<Writer?> get changes;
  Future<void> signIn(String email, String password);

  /// Returns true when the account needs the email confirmed before signing in.
  Future<bool> signUp(String email, String password, {String? name});
  Future<void> resetPassword(String email);
  Future<void> signInWithGoogle();
  Future<void> signInWithApple();
  bool get appleAvailable;
  Future<void> updatePassword(String password);

  /// The current session's access token (for Edge Function calls), or null.
  Future<String?> accessToken();
  Future<void> signOut();
}

/// Where Supabase sends the writer back after Google sign-in and email links. Add it to
/// Supabase → Authentication → URL Configuration → Redirect URLs.
const authRedirect = 'in.getlitma.app://auth-callback';

class SupabaseAuth implements AuthGateway {
  SupabaseAuth(this.client, this.prefs) {
    _sub = client.auth.onAuthStateChange.listen((s) {
      if (s.event == AuthChangeEvent.signedOut) {
        _remember(null);
      } else if (s.session?.user != null) {
        _remember(s.session!.user);
      }
      _changes.add(writer);
    });
  }

  final SupabaseClient client;
  final SharedPreferences prefs;
  final _changes = StreamController<Writer?>.broadcast();
  StreamSubscription<AuthState>? _sub;

  static const _key = 'litma:offline-user';

  void _remember(User? u) {
    if (u == null) {
      prefs.remove(_key);
    } else {
      prefs.setString(_key, jsonEncode({'id': u.id, 'email': u.email, 'name': u.userMetadata?['full_name'] ?? u.userMetadata?['name']}));
    }
  }

  /// The session is kept on the phone; offline an expired one can't refresh, and the writer
  /// remembered on this phone stays signed in (cleared only by signing out), like the web app.
  @override
  Writer? get writer {
    final u = client.auth.currentUser;
    if (u != null) return Writer(id: u.id, email: u.email, name: u.userMetadata?['full_name'] as String? ?? u.userMetadata?['name'] as String?);
    final raw = prefs.getString(_key);
    if (raw == null || client.auth.currentSession == null) return null;
    final j = jsonDecode(raw) as Map<String, dynamic>;
    return Writer(id: j['id'] as String, email: j['email'] as String?, name: j['name'] as String?);
  }

  @override
  Stream<Writer?> get changes => _changes.stream;

  Future<T> _guard<T>(Future<T> Function() f) async {
    try {
      return await f();
    } catch (e) {
      if (isNetworkError(e)) throw const OfflineException();
      rethrow;
    }
  }

  @override
  Future<void> signIn(String email, String password) => _guard(() => client.auth.signInWithPassword(email: email.trim(), password: password)).then((_) => Analytics.track('sign_in', {'method': 'password'}));

  @override
  Future<bool> signUp(String email, String password, {String? name}) => _guard(() async {
        final r = await client.auth.signUp(
          email: email.trim(),
          password: password,
          emailRedirectTo: authRedirect,
          data: name == null || name.trim().isEmpty ? null : {'full_name': name.trim()},
        );
        return r.session == null;
      });

  @override
  Future<void> resetPassword(String email) => _guard(() => client.auth.resetPasswordForEmail(email.trim(), redirectTo: authRedirect));

  @override
  Future<void> signInWithGoogle() => _guard(() => client.auth.signInWithOAuth(OAuthProvider.google, redirectTo: authRedirect)).then((_) => Analytics.track('sign_in', {'method': 'google'}));

  @override
  bool get appleAvailable => !kIsWeb && Platform.isIOS;

  /// Native Sign in with Apple, then a Supabase session from Apple's token (with a nonce).
  @override
  Future<void> signInWithApple() => _guard(() async {
        final raw = _nonce();
        final cred = await SignInWithApple.getAppleIDCredential(
          scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
          nonce: sha256.convert(utf8.encode(raw)).toString(),
        );
        final token = cred.identityToken;
        if (token == null) throw const AuthException('Apple did not return a sign-in token.');
        await client.auth.signInWithIdToken(provider: OAuthProvider.apple, idToken: token, nonce: raw);
        final name = [cred.givenName, cred.familyName].whereType<String>().join(' ').trim();
        if (name.isNotEmpty) await client.auth.updateUser(UserAttributes(data: {'full_name': name}));
      });

  @override
  Future<String?> accessToken() async => client.auth.currentSession?.accessToken;

  @override
  Future<void> updatePassword(String password) => _guard(() => client.auth.updateUser(UserAttributes(password: password)));

  @override
  Future<void> signOut() async {
    _remember(null);
    await client.auth.signOut();
  }

  static String _nonce([int length = 32]) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final r = Random.secure();
    return List.generate(length, (_) => chars[r.nextInt(chars.length)]).join();
  }

  void dispose() {
    _sub?.cancel();
    _changes.close();
  }
}

/// Plain-language sign-in errors (same wording as the web's authMessage()).
String authMessage(Object e) {
  if (e is OfflineException) return "Can't reach the server. Check your connection and try again.";
  final m = e is AuthException ? e.message : '$e';
  if (RegExp('invalid login credentials', caseSensitive: false).hasMatch(m)) return "That email and password don't match. Check them, or reset your password.";
  if (RegExp('email not confirmed', caseSensitive: false).hasMatch(m)) return 'Confirm your email first. Open the link we sent you, then sign in.';
  if (RegExp('already registered|already exists', caseSensitive: false).hasMatch(m)) return 'An account with this email already exists. Sign in instead.';
  if (RegExp('password should be at least', caseSensitive: false).hasMatch(m)) return 'Use a password of at least 8 characters.';
  if (RegExp('rate limit|too many', caseSensitive: false).hasMatch(m)) return 'Too many attempts. Wait a minute, then try again.';
  if (RegExp('canceled|cancelled', caseSensitive: false).hasMatch(m)) return '';
  return m.isEmpty ? 'Something went wrong. Try again.' : m;
}
