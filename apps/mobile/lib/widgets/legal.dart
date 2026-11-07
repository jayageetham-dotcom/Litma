import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../core/i18n.dart';
import '../core/theme.dart';

/// Open Litma's Privacy Policy or Terms of Use on the website.
Future<void> openLegal(String page) => launchUrl(Uri.parse('${AppConfig.site}/$page/'), mode: LaunchMode.inAppBrowserView);

/// "Terms of Use · Privacy Policy" as two small links (welcome screen, sign-up).
class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key, this.agree = false});

  /// Lead with "By creating an account you agree to Litma's terms:".
  final bool agree;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final style = TextStyle(fontSize: 12.5, color: c.muted, height: 1.4);
    Widget link(String key, String page) => Semantics(
          link: true,
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: () => openLegal(page),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Text(context.t(key), style: style.copyWith(color: c.accent, fontWeight: FontWeight.w600, decoration: TextDecoration.underline, decorationColor: c.accent)),
            ),
          ),
        );
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (agree) Text(context.t('legal.agree'), style: style, textAlign: TextAlign.center),
        link('legal.terms', 'terms'),
        Text('·', style: style),
        link('legal.privacy', 'privacy'),
      ],
    );
  }
}
