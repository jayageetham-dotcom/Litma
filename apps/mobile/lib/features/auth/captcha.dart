import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// Supabase asked for the human check (CAPTCHA is switched on in Supabase Auth).
bool isCaptchaError(Object e) =>
    e is AuthException && ((e.code ?? '') == 'captcha_failed' || e.message.toLowerCase().contains('captcha'));

/// Runs [call] without a token first; if Supabase answers that a captcha is needed, shows the check
/// (getlitma.in/captcha/ in a web view: Cloudflare Turnstile only runs on the site's own address)
/// and runs [call] again with its token. Same flow as the web's components/auth/Captcha.tsx, so
/// nothing changes until the owner switches CAPTCHA on, and the app needs no setting of its own.
Future<T> withCaptcha<T>(BuildContext context, Future<T> Function(String? token) call) async {
  try {
    return await call(null);
  } catch (e) {
    if (!isCaptchaError(e) || !context.mounted) rethrow;
    final token = await showModalBottomSheet<String>(context: context, isScrollControlled: true, builder: (_) => const _CaptchaSheet());
    if (token == null) rethrow;
    return call(token);
  }
}

class _CaptchaSheet extends StatefulWidget {
  const _CaptchaSheet();
  @override
  State<_CaptchaSheet> createState() => _CaptchaSheetState();
}

class _CaptchaSheetState extends State<_CaptchaSheet> {
  WebViewController? _web;
  bool _failed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_web != null) return;
    final lang = I18n.of(context).locale == 'ml' ? 'ml' : 'en';
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel('LitmaCaptcha', onMessageReceived: (m) {
        try {
          final msg = jsonDecode(m.message) as Map<String, dynamic>;
          final token = msg['token'] as String?;
          if (token != null && token.isNotEmpty) {
            if (mounted) Navigator.pop(context, token);
          } else if (mounted) {
            setState(() => _failed = true);
          }
        } catch (_) {
          if (mounted) setState(() => _failed = true);
        }
      })
      ..loadRequest(Uri.parse('${AppConfig.site}/captcha/?lang=$lang&app=1'));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Icon(LucideIcons.shieldCheck, size: 20, color: c.accent),
            const SizedBox(width: 10),
            Expanded(child: Text(context.t('auth.captchaTitle'), style: text.titleMedium)),
            IconButton(icon: const Icon(LucideIcons.x, size: 18), tooltip: context.t('common.close'), onPressed: () => Navigator.pop(context)),
          ]),
          Text(context.t('auth.captchaHint'), style: text.bodySmall?.copyWith(color: c.muted)),
          const SizedBox(height: 14),
          SizedBox(height: 90, child: WebViewWidget(controller: _web!)),
          if (_failed) ...[
            const SizedBox(height: 8),
            Text(context.t('auth.captchaFailed'), style: text.bodySmall?.copyWith(color: c.danger)),
          ],
        ]),
      ),
    );
  }
}
