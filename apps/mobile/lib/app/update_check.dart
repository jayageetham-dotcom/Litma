import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';

/// Compares semver strings: -1, 0, 1.
int compareVersions(String a, String b) {
  List<int> parts(String v) => v.split('+').first.split('.').map((x) => int.tryParse(x) ?? 0).toList();
  final x = parts(a), y = parts(b);
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d.sign;
  }
  return 0;
}

/// The phone app's update prompt (apps/mobile/README.md): reads the `mobile` block of latest.json.
/// A newer version → a gentle card with a store link; below `minimumVersion` → a screen that asks to
/// update (for server changes old apps can't handle). Never on a timer by itself.
class UpdateGate extends StatefulWidget {
  const UpdateGate({super.key, required this.child});
  final Widget child;

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> {
  String? _latest;
  String? _store;
  bool _required = false;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      Map<String, dynamic>? feed;
      for (final url in [AppConfig.latestJson, AppConfig.latestJsonFallback]) {
        try {
          final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 8));
          if (r.statusCode == 200) {
            feed = jsonDecode(r.body) as Map<String, dynamic>;
            break;
          }
        } catch (_) {}
      }
      final m = (feed?['mobile'] as Map?)?.cast<String, dynamic>();
      final version = m?['version'] as String?;
      if (m == null || version == null) return;
      final store = (Platform.isIOS ? m['ios'] : m['android']) as String?;
      final min = m['minimumVersion'] as String?;
      if (!mounted) return;
      setState(() {
        _store = store;
        _required = min != null && compareVersions(info.version, min) < 0;
        _latest = compareVersions(version, info.version) > 0 ? version : null;
      });
    } catch (_) {
      /* offline or no feed: nothing to show */
    }
  }

  void _open() {
    if (_store != null) launchUrl(Uri.parse(_store!), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (_required && _store != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.download, size: 40, color: c.accent),
              const SizedBox(height: 16),
              Text(context.t('update.required'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 20),
              FilledButton(onPressed: _open, child: Text(context.t('update.updateNow'))),
            ]),
          ),
        ),
      );
    }
    final show = _latest != null && _store != null && !_dismissed;
    return Stack(children: [
      widget.child,
      Positioned(
        left: 16,
        right: 16,
        bottom: 84 + MediaQuery.paddingOf(context).bottom,
        child: AnimatedSwitcher(
          duration: Motion.of(context, Motion.medium),
          transitionBuilder: (child, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, 0.4), end: Offset.zero).animate(a), child: child)),
          child: !show
              ? const SizedBox.shrink()
              : Material(
                  key: const ValueKey('update'),
                  color: c.surface,
                  elevation: 8,
                  borderRadius: BorderRadius.circular(LitmaRadius.lg),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                    child: Row(children: [
                      Icon(LucideIcons.sparkles, color: c.accent),
                      const SizedBox(width: 12),
                      Expanded(child: Text(context.t('update.desktopTitle', {'version': _latest}), style: Theme.of(context).textTheme.titleSmall)),
                      TextButton(onPressed: () => setState(() => _dismissed = true), style: TextButton.styleFrom(foregroundColor: c.muted), child: Text(context.t('update.later'))),
                      FilledButton(onPressed: _open, child: Text(context.t('update.updateNow'))),
                    ]),
                  ),
                ),
        ),
      ),
    ]);
  }
}
