import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/config.dart';
import 'core/i18n.dart';
import 'data/auth.dart';
import 'data/backend.dart';
import 'data/local_db.dart';
import 'data/offline.dart';
import 'data/store.dart';
import 'data/analytics.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  final (prefs, messages, db) = await (SharedPreferences.getInstance(), Strings.loadAll(), SqliteDb.open()).wait;
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(authFlowType: AuthFlowType.pkce),
  );
  final client = Supabase.instance.client;
  final auth = SupabaseAuth(client, prefs);
  final offline = OfflineLayer(db: db, backend: SupabaseBackend(client), uid: () => auth.writer?.id);
  final services = Services(auth: auth, offline: offline, store: Store(offline), prefs: prefs, messages: messages)..watchNetwork();

  // usage statistics (switch in Settings); sends nothing outside iOS and Android
  unawaited(Analytics.start(prefs: prefs, token: auth.accessToken, english: messages['en'] ?? const {}));

  runApp(ProviderScope(overrides: [servicesProvider.overrideWithValue(services)], child: const LitmaApp()));
}
