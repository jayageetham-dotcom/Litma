import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/config.dart';
import '../core/i18n.dart';
import '../data/auth.dart';
import '../data/models.dart';
import '../data/offline.dart';
import '../data/store.dart';

/// Everything the app talks to, made once at start (Supabase in the app; fakes in tests and previews).
class Services {
  Services({required this.auth, required this.offline, required this.store, required this.prefs, required this.messages, Transliterator? transliterator})
      : transliterator = transliterator ?? Transliterator();
  final AuthGateway auth;
  final OfflineLayer offline;
  final Store store;
  final SharedPreferences prefs;
  final Map<String, Map<String, dynamic>> messages;
  final Transliterator transliterator;
  StreamSubscription<List<ConnectivityResult>>? _net;

  /// Follow the phone's network: no network means offline at once; back online starts a sync.
  void watchNetwork() {
    _net = Connectivity().onConnectivityChanged.listen((r) => offline.setDeviceOffline(r.isEmpty || r.every((x) => x == ConnectivityResult.none)));
    Connectivity().checkConnectivity().then((r) => offline.setDeviceOffline(r.isEmpty || r.every((x) => x == ConnectivityResult.none)));
    offline.start();
  }

  void dispose() {
    _net?.cancel();
    offline.dispose();
  }
}

final servicesProvider = Provider<Services>((ref) => throw UnimplementedError('override in main()'));

// ── app settings (per device, like the web's litma:theme and litma:locale) ──

@immutable
class AppSettings {
  const AppSettings({this.themeMode = ThemeMode.system, this.locale = Strings.defaultLocale});
  final ThemeMode themeMode;
  final String locale;
  AppSettings copyWith({ThemeMode? themeMode, String? locale}) => AppSettings(themeMode: themeMode ?? this.themeMode, locale: locale ?? this.locale);
}

class SettingsNotifier extends Notifier<AppSettings> {
  SharedPreferences get _prefs => ref.read(servicesProvider).prefs;

  @override
  AppSettings build() {
    final theme = switch (_prefs.getString('litma:theme')) { 'dark' => ThemeMode.dark, 'light' => ThemeMode.light, _ => ThemeMode.system };
    final locale = _prefs.getString('litma:locale');
    return AppSettings(themeMode: theme, locale: Strings.locales.containsKey(locale) ? locale! : Strings.defaultLocale);
  }

  void setTheme(ThemeMode m) {
    state = state.copyWith(themeMode: m);
    if (m == ThemeMode.system) {
      _prefs.remove('litma:theme');
    } else {
      _prefs.setString('litma:theme', m == ThemeMode.dark ? 'dark' : 'light');
    }
  }

  void setLocale(String code) {
    state = state.copyWith(locale: code);
    _prefs.setString('litma:locale', code);
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

final stringsProvider = Provider<Strings>((ref) {
  final s = ref.watch(servicesProvider);
  final code = ref.watch(settingsProvider.select((x) => x.locale));
  return Strings(code, s.messages[code] ?? const {}, s.messages['en'] ?? const {});
});

// ── the writer ──

final writerProvider = StreamProvider<Writer?>((ref) async* {
  final auth = ref.watch(servicesProvider).auth;
  yield auth.writer;
  yield* auth.changes;
});

final profileProvider = FutureProvider<Profile?>((ref) async {
  final w = ref.watch(writerProvider).value;
  if (w == null) return null;
  return ref.read(servicesProvider).store.getProfile(w.id, email: w.email);
});

/// Offline / sync state for the status pill and the editor.
final syncStateProvider = StreamProvider<SyncState>((ref) {
  final n = ref.watch(servicesProvider).offline.state;
  final c = StreamController<SyncState>();
  void push() => c.add(n.value);
  n.addListener(push);
  push();
  ref.onDispose(() {
    n.removeListener(push);
    c.close();
  });
  return c.stream;
});
