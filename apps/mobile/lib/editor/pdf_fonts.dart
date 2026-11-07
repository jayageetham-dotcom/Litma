import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// Document fonts the app bundles (CSS name → file prefix in assets/fonts).
const _files = {
  'Noto Serif Malayalam': 'NotoSerifMalayalam',
  'Noto Sans Malayalam': 'NotoSansMalayalam',
  'Manjari': 'Manjari',
  'Gayathri': 'Gayathri',
  'Anek Malayalam': 'AnekMalayalam',
};

final _cache = <String, String>{};

/// `@font-face` rules that carry the app's own font files (regular and bold) into HTML for PDFs.
/// The phone's web engine lays out the PDF, and phones don't all have these fonts (iPhones have
/// no Noto Serif Malayalam, Manjari or Gayathri), so without them a PDF falls back to whatever
/// Malayalam font the phone has. Noto Serif Malayalam is always included as the fallback.
Future<String> fontFaceCss(Iterable<String?> names) async {
  final out = StringBuffer();
  for (final name in {...names.whereType<String>(), 'Noto Serif Malayalam'}) {
    final base = _files[name];
    if (base == null) continue;
    for (final (weight, file) in [(400, '${base}_400Regular.ttf'), (700, '${base}_700Bold.ttf')]) {
      final key = '$name/$weight';
      final rule = _cache[key] ??= await () async {
        final data = await rootBundle.load('assets/fonts/$file');
        final b64 = base64Encode(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
        return "@font-face { font-family: '$name'; font-weight: $weight; src: url(data:font/ttf;base64,$b64) format('truetype'); }";
      }();
      out.writeln(rule);
    }
  }
  return out.toString();
}
