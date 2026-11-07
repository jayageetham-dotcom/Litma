import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/config.dart';

/// Usage statistics for the owner's /admin/ page, the same events as the web's
/// apps/web/src/lib/analytics.ts, sent to the litma-track Edge Function with platform ios/android.
///
/// Sent: screen views as the web's page paths (no ids), taps on the app's main tools labelled with
/// the English interface string, a few named actions (new work, new book, export, dictionary
/// lookup, sign-in), active time, and the device context (phone or tablet, screen size, language,
/// app version). Never sent: writing, titles, names, search words, ids. The Settings switch
/// (`litma:usage-stats` = off, same key as the web) stops it. Nothing is sent outside iOS and
/// Android (tests, desktop runs).
class Analytics with WidgetsBindingObserver {
  Analytics._(this._prefs, this._token, this._client, this._english, this._platform);

  /// The running app's statistics; null in tests and before start (every call is then a no-op).
  static Analytics? instance;

  static const optOutKey = 'litma:usage-stats';
  static const _vidKey = 'litma:vid';
  static const _idle = Duration(minutes: 30);
  static const _active = Duration(seconds: 60);

  final SharedPreferences _prefs;
  final Future<String?> Function() _token;
  final http.Client _client;
  final Map<String, dynamic> _english;
  final String _platform;
  final _queue = <Map<String, Object?>>[];
  String _sid = _id();
  DateTime _lastEvent = DateTime.now();
  DateTime _lastInput = DateTime.now();
  int _engaged = 0;
  String _path = '/';
  String _version = '';
  bool _foreground = true;
  Timer? _tick;
  Timer? _send;

  static String _id() {
    final r = Random.secure();
    return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  /// Whether the writer shares statistics (on unless switched off, like the web).
  static bool enabledIn(SharedPreferences prefs) => prefs.getString(optOutKey) != 'off';

  static Future<void> setEnabled(SharedPreferences prefs, bool on) async {
    if (on) {
      await prefs.remove(optOutKey);
    } else {
      await prefs.setString(optOutKey, 'off');
      instance?._queue.clear();
    }
  }

  /// Start once at app start. [english] is the English strings (labels are sent in English
  /// whatever language the app shows, so the admin page counts each button once).
  static Future<void> start({required SharedPreferences prefs, required Future<String?> Function() token, required Map<String, dynamic> english, http.Client? client}) async {
    if (instance != null) return;
    final platform = Platform.isIOS ? 'ios' : (Platform.isAndroid ? 'android' : null);
    if (platform == null) return;
    final a = Analytics._(prefs, token, client ?? http.Client(), english, platform);
    instance = a;
    a._version = await PackageInfo.fromPlatform().then((p) => p.version).catchError((_) => '');
    WidgetsBinding.instance.addObserver(a);
    a._tick = Timer.periodic(const Duration(seconds: 5), (_) {
      if (a._foreground && DateTime.now().difference(a._lastInput) < _active) a._engaged += 5;
    });
    a._send = Timer.periodic(const Duration(seconds: 20), (_) {
      if (a._queue.isNotEmpty || a._engaged >= 120) unawaited(a._flush());
    });
  }

  bool get _on => enabledIn(_prefs);

  /// Record one event: a snake_case name and small values (never writing).
  static void track(String name, [Map<String, Object> props = const {}]) => instance?._add(name, props: props);

  /// A screen opened, as the web's page path ("/write/", "/book/", …).
  static void screen(String path) {
    final a = instance;
    if (a == null) return;
    a._path = path;
    a._add('page_view');
  }

  /// A tap on one of the app's tools, labelled by its interface string [key] (in English).
  static void tap(String key, [Map<String, Object> props = const {}]) {
    final a = instance;
    if (a == null) return;
    final label = a._label(key);
    if (label != null) a._add('click', props: {'el': 'button', ...props}, label: label);
  }

  /// Any touch: keeps "active time" counting while the writer is working.
  static void input() => instance?._lastInput = DateTime.now();

  String? _label(String key) {
    Object? v = _english;
    for (final part in key.split('.')) {
      v = v is Map ? v[part] : null;
    }
    return v is String ? v.replaceAll(RegExp(r'[\s:…·.,]+$'), '').trim() : null;
  }

  void _add(String name, {Map<String, Object> props = const {}, String? label}) {
    if (!_on) return;
    final now = DateTime.now();
    if (now.difference(_lastEvent) > _idle) _sid = _id();
    _lastEvent = now;
    _queue.add({'n': name, 'p': _path, if (label != null) 'l': label, if (props.isNotEmpty) 'props': props, 't': now.millisecondsSinceEpoch});
    if (_queue.length >= 40) unawaited(_flush());
  }

  Map<String, Object?> _context() {
    final view = WidgetsBinding.instance.platformDispatcher.views.firstOrNull;
    final size = view == null ? Size.zero : view.physicalSize / view.devicePixelRatio;
    return {
      'platform': _platform,
      'device': size.shortestSide >= 600 ? 'tablet' : 'phone',
      'lang': Platform.localeName.split('.').first.replaceAll('_', '-'),
      'locale': _prefs.getString('litma:locale') ?? 'en',
      'screen': '${size.width.round()}x${size.height.round()}',
      'v': _version,
    };
  }

  Future<void> _flush() async {
    if (!_on) return;
    if (_engaged >= 5) {
      _queue.add({'n': 'engagement', 'p': _path, 'props': {'seconds': _engaged}, 't': DateTime.now().millisecondsSinceEpoch});
      _engaged = 0;
    }
    if (_queue.isEmpty) return;
    final events = _queue.take(60).toList();
    _queue.removeRange(0, events.length);
    var vid = _prefs.getString(_vidKey);
    if (vid == null) {
      vid = _id();
      await _prefs.setString(_vidKey, vid);
    }
    final token = await _token().catchError((_) => null);
    try {
      await _client
          .post(
            Uri.parse('${AppConfig.functionsUrl}/litma-track'),
            headers: {'content-type': 'application/json', 'apikey': AppConfig.supabaseAnonKey, 'authorization': 'Bearer ${token ?? AppConfig.supabaseAnonKey}'},
            body: jsonEncode({'vid': vid, 'sid': _sid, 'ctx': _context(), 'events': events}),
          )
          .timeout(const Duration(seconds: 10));
    } catch (_) {
      // statistics are best-effort: offline or failed sends are dropped
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) unawaited(_flush());
  }

  /// Stop (used by tests that start it with a fake client).
  void dispose() {
    _tick?.cancel();
    _send?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    if (identical(instance, this)) instance = null;
  }
}
