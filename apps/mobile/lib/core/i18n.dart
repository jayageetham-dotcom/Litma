import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// UI strings from packages/i18n (copied into assets/i18n by npm run mobile:assets), with the same
/// keys and rules as the web's translate(): dotted keys, {param} placeholders, plural keys
/// `_one` / `_other` picked by {count}, English as the fallback for anything missing.
class Strings {
  Strings(this.locale, this._messages, this._fallback);

  final String locale;
  final Map<String, dynamic> _messages;
  final Map<String, dynamic> _fallback;

  static const locales = {'en': 'English', 'ml': 'മലയാളം'};
  static const defaultLocale = 'en';

  static Future<Map<String, Map<String, dynamic>>> loadAll() async {
    final out = <String, Map<String, dynamic>>{};
    for (final code in locales.keys) {
      out[code] = jsonDecode(await rootBundle.loadString('assets/i18n/$code.json')) as Map<String, dynamic>;
    }
    return out;
  }

  dynamic _lookup(Map<String, dynamic> m, String key) {
    dynamic node = m;
    for (final part in key.split('.')) {
      if (node is Map<String, dynamic> && node.containsKey(part)) {
        node = node[part];
      } else {
        return null;
      }
    }
    return node;
  }

  String t(String key, [Map<String, Object?> params = const {}]) {
    String? pick(Map<String, dynamic> m) {
      if (params.containsKey('count')) {
        final n = params['count'] as num;
        final plural = _lookup(m, '${key}_${n == 1 ? 'one' : 'other'}');
        if (plural is String) return plural;
      }
      final v = _lookup(m, key);
      return v is String ? v : null;
    }

    var s = pick(_messages) ?? pick(_fallback) ?? key;
    params.forEach((k, v) => s = s.replaceAll('{$k}', v is int ? groupIndian(v) : '$v'));
    return s;
  }
}

/// 1234567 → 12,34,567 (Indian grouping, as the web shows numbers with en-IN).
String groupIndian(int n) {
  final neg = n < 0;
  final s = n.abs().toString();
  if (s.length <= 3) return neg ? '-$s' : s;
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${neg ? '-' : ''}${parts.join(',')},$last3';
}

/// Makes the current [Strings] available to every widget: `context.t('desk.newWork')`.
class I18n extends InheritedWidget {
  const I18n({super.key, required this.strings, required super.child});
  final Strings strings;

  static Strings of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<I18n>()!.strings;

  @override
  bool updateShouldNotify(I18n old) => old.strings.locale != strings.locale;
}

extension I18nContext on BuildContext {
  String t(String key, [Map<String, Object?> params = const {}]) => I18n.of(this).t(key, params);
}
