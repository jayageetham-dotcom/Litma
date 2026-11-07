import 'dart:convert';

import 'package:flutter/material.dart';

import '../../data/forms.dart' show Json;
import '../../widgets/avatar.dart';

/// Book covers, drawn like the web's CoverFront / CoverBack (apps/web/src/components/book/Cover.tsx)
/// in the same 210 × 297 mm space, so positions dragged in millimetres match on every app and in
/// the PDF. Keep this file in step with Cover.tsx, CoverArt.tsx, Barcode.tsx and book-samples.ts.

const coverW = 210.0;
const coverH = 297.0;

/// Logical pixels per millimetre in the design space; [CoverView] scales the result to fit.
const _k = 3.0;
double _mm(num v) => v * _k;
double _pt(num v) => v * 0.35278 * _k;

// ── layouts, fonts, presets, backgrounds ──

const coverTemplates = <String, Json>{
  'art': {'bg': '#0b2f3a', 'fg': '#fdf6e3', 'accent': '#e9c46a', 'art': 'fantasy'},
  'kasavu': {'bg': '#f7f3e8', 'fg': '#1a2220', 'accent': '#a17a28'},
  'solid': {'bg': '#1d5a52', 'fg': '#ffffff', 'accent': '#d2ad5c'},
  'photo': {'bg': '#111916', 'fg': '#ffffff', 'accent': '#d2ad5c', 'imageOpacity': 0.9},
  'type': {'bg': '#e9e1cf', 'fg': '#3b1f1a', 'accent': '#a3372b'},
  'minimal': {'bg': '#ffffff', 'fg': '#1a2220', 'accent': '#1d5a52'},
};

/// Layout tiles in the designer's order (ids stay as saved by the web).
const coverLayouts = ['art', 'kasavu', 'solid', 'photo', 'type', 'minimal'];

/// Title fonts: (name saved in cover.font, kind, Flutter family).
const coverFonts = <(String, String, String)>[
  ('Anek Malayalam', 'sans', 'AnekMalayalam'),
  ('Noto Sans Malayalam', 'sans', 'NotoSansMalayalam'),
  ('Manjari', 'sans', 'Manjari'),
  ('Gayathri', 'sans', 'Gayathri'),
  ('Meera', 'sans', 'Meera'),
  ('Baloo Chettan 2', 'sans', 'BalooChettan2'),
  ('Karumbi', 'calligraphy', 'Karumbi'),
  ('Chilanka', 'calligraphy', 'Chilanka'),
  ('Dyuthi', 'calligraphy', 'Dyuthi'),
  ('Uroob', 'display', 'Uroob'),
  ('Noto Serif Malayalam', 'serif', 'NotoSerifMalayalam'),
  ('Rachana', 'serif', 'Rachana'),
];

String coverFamily(String? name) => coverFonts.where((f) => f.$1 == name).firstOrNull?.$3 ?? 'AnekMalayalam';

const coverPresets = <String, Json>{
  'classic': {'template': 'kasavu', 'frame': true, 'art': 'literary', 'bg': '#efe9dc', 'fg': '#3d4232', 'accent': '#a8875a', 'font': 'Rachana', 'ornament': 'flourish'},
  'epic': {'template': 'art', 'art': 'fantasy', 'bg': '#0b2f3a', 'fg': '#fdf6e3', 'accent': '#e9c46a', 'font': 'Uroob', 'ornament': 'line', 'titleShadow': true},
  'romance': {'template': 'art', 'art': 'romance', 'bg': '#f6c9cf', 'fg': '#5a2238', 'accent': '#b5546f', 'font': 'Karumbi', 'ornament': 'flourish', 'titleScale': 1.55},
  'noir': {'template': 'type', 'art': 'thriller', 'bg': '#0a0e13', 'fg': '#e8eef5', 'accent': '#c8102e', 'font': 'Anek Malayalam', 'ornament': 'none', 'titleShadow': true, 'titleScale': 0.75},
  'space': {'template': 'solid', 'art': 'scifi', 'bg': '#050a1f', 'fg': '#e9fbff', 'accent': '#4fe3ff', 'font': 'Baloo Chettan 2', 'ornament': 'line', 'titleShadow': true, 'titleScale': 0.9},
  'gothic': {'template': 'art', 'art': 'horror', 'bg': '#151b18', 'fg': '#e9e6d6', 'accent': '#d9c45a', 'font': 'Dyuthi', 'ornament': 'flourish', 'titleShadow': true},
  'harbour': {'template': 'art', 'art': 'historical', 'bg': '#1d2a44', 'fg': '#fbecd0', 'accent': '#e7a85a', 'font': 'Noto Serif Malayalam', 'ornament': 'flourish', 'titleBox': true, 'titleBoxColor': '#1d2a44', 'titleBoxOpacity': 0.55, 'titleScale': 0.9},
  'modern': {'template': 'solid', 'art': 'selfhelp', 'bg': '#0b2350', 'fg': '#ffffff', 'accent': '#ffb15a', 'font': 'Meera', 'ornament': 'line', 'titleScale': 0.9},
  'paper': {'template': 'minimal', 'art': null, 'bg': '#faf7f0', 'fg': '#1f2421', 'accent': '#8a5a2b', 'font': 'Manjari', 'ornament': 'flourish', 'titleScale': 1.3},
  'bold': {'template': 'type', 'art': null, 'bg': '#e9e1cf', 'fg': '#3b1f1a', 'accent': '#a3372b', 'font': 'Anek Malayalam', 'ornament': 'line', 'titleScale': 0.8},
};

/// The full patch for a preset: its look, everything else back to the design's defaults (presetPatch).
Json presetPatch(String id) => {
      'preset': id,
      'frame': false,
      'titleShadow': false,
      'titleBox': false,
      'titleBoxColor': null,
      'titleBoxOpacity': null,
      'titleScale': 1,
      'offsets': <String, dynamic>{},
      'sizes': <String, dynamic>{},
      'image': null,
      ...coverPresets[id]!,
    };

/// Genre backgrounds with the colours that read well on each (COVER_ART).
const coverArt = <String, (String, String, String)>{
  'fantasy': ('#0b2f3a', '#fdf6e3', '#e9c46a'),
  'thriller': ('#0a0e13', '#e8eef5', '#c8102e'),
  'romance': ('#f6c9cf', '#6b2f45', '#b5546f'),
  'scifi': ('#050a1f', '#e9fbff', '#4fe3ff'),
  'horror': ('#151b18', '#e9e6d6', '#d9c45a'),
  'literary': ('#efe9dc', '#3d4232', '#a8875a'),
  'historical': ('#1d2a44', '#fbecd0', '#e7a85a'),
  'selfhelp': ('#0b2350', '#ffffff', '#ffb15a'),
};

const _movedArt = {'backwaters': 'literary', 'palms': 'romance', 'monsoon': 'thriller', 'hills': 'fantasy', 'night': 'scifi', 'leaves': 'literary', 'birds': 'selfhelp', 'quill': 'literary', 'circles': 'selfhelp', 'weave': 'selfhelp'};

String? coverArtId(Object? id) => id is String ? (coverArt.containsKey(id) ? id : _movedArt[id]) : null;

/// Parts the writer can drag; offsets are millimetres (COVER_PARTS).
const coverPartsFront = ['title', 'author', 'badge', 'mark'];
const coverPartsBack = ['back-head', 'back-text', 'back-imprint'];

const defaultPublisher = 'Litma Publishing House';

Json resolveCover(Json cover) {
  final t = coverTemplates.containsKey(cover['template']) ? cover['template'] as String : 'kasavu';
  return {...coverTemplates[t]!, ...cover, 'template': t};
}

Color coverColor(Object? css, [Color fallback = const Color(0xFF1A2220)]) {
  final m = css is String ? RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(css.trim()) : null;
  return m == null ? fallback : Color(int.parse('FF${m[1]}', radix: 16));
}

// ── sample values (book-samples.ts) ──

const sampleIsbn = '978-0-000-00000-2';

/// Fields the writer never set (missing or null) get real sample text, so they edit instead of
/// filling blanks; a cleared field stays empty. Returns the patch to save, or null when none.
Json? bookSamples(Json row) {
  bool unset(Object? v) => v == null;
  final s = <String, dynamic>{...((row['settings'] as Map?)?.cast<String, dynamic>() ?? const {})};
  final c = <String, dynamic>{...((row['cover'] as Map?)?.cast<String, dynamic>() ?? const {})};
  final settings = {
    ...s,
    'publisher': unset(s['publisher']) ? defaultPublisher : s['publisher'],
    'year': unset(s['year']) ? '${DateTime.now().year}' : s['year'],
    'edition': unset(s['edition']) ? 'ഒന്നാം പതിപ്പ്' : s['edition'],
    'isbn': unset(s['isbn']) ? sampleIsbn : s['isbn'],
  };
  final cover = {
    ...c,
    'blurb': unset(c['blurb'])
        ? 'ഇവിടെ നിങ്ങളുടെ പുസ്തകത്തെക്കുറിച്ച് മൂന്നോ നാലോ വാചകങ്ങൾ എഴുതുക. കഥ എവിടെ തുടങ്ങുന്നു, ആരുടെ യാത്രയാണ്, വായനക്കാരെ എന്താണ് കാത്തിരിക്കുന്നത് എന്ന് ചുരുക്കി പറയാം. ഈ എഴുത്ത് മാറ്റി നിങ്ങളുടേതാക്കുക.'
        : c['blurb'],
    'authorBio': unset(c['authorBio']) ? 'എഴുത്തുകാരെക്കുറിച്ച് ഒരു ചെറുകുറിപ്പ്: നാട്, ഇതുവരെ എഴുതിയ പുസ്തകങ്ങൾ, ലഭിച്ച അംഗീകാരങ്ങൾ.' : c['authorBio'],
    'price': unset(c['price']) ? '₹ 250' : c['price'],
    'genreLine': unset(c['genreLine']) ? 'മലയാളം നോവൽ' : c['genreLine'],
    'category': unset(c['category']) ? 'Fiction' : c['category'],
    'coverCredit': unset(c['coverCredit']) ? 'Cover design: Litma' : c['coverCredit'],
    'publisherTagline': unset(c['publisherTagline']) ? 'Malayalam books' : c['publisherTagline'],
    'website': unset(c['website']) ? 'getlitma.in' : c['website'],
  };
  final patch = <String, dynamic>{
    if (unset(row['subtitle'])) 'subtitle': 'നോവൽ',
    if (unset(row['author'])) 'author': 'എഴുത്തുകാരുടെ പേര്',
    if (jsonEncode(settings) != jsonEncode(s)) 'settings': settings,
    if (jsonEncode(cover) != jsonEncode(c)) 'cover': cover,
  };
  return patch.isEmpty ? null : patch;
}

// ── EAN-13 barcode from an ISBN (Barcode.tsx) ──

const _l = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
final _r = [for (final p in _l) p.split('').map((b) => b == '0' ? '1' : '0').join()];
final _g = [for (final p in _r) p.split('').reversed.join()];
const _parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

int _check13(String d12) {
  var s = 0;
  for (var i = 0; i < 12; i++) {
    s += int.parse(d12[i]) * (i.isOdd ? 3 : 1);
  }
  return (10 - s % 10) % 10;
}

/// ISBN-10 or ISBN-13 (any hyphens or spaces) → 13 digits, or null.
String? isbn13(Object? isbn) {
  final s = '${isbn ?? ''}'.replaceAll(RegExp('[^0-9Xx]'), '').toUpperCase();
  if (RegExp(r'^\d{13}$').hasMatch(s)) return _check13(s.substring(0, 12)) == int.parse(s[12]) ? s : null;
  if (RegExp(r'^\d{9}[\dX]$').hasMatch(s)) {
    final d12 = '978${s.substring(0, 9)}';
    return '$d12${_check13(d12)}';
  }
  return null;
}

class _BarcodePainter extends CustomPainter {
  _BarcodePainter(this.digits);
  final String digits;

  @override
  void paint(Canvas canvas, Size size) {
    final d = digits;
    final par = _parity[int.parse(d[0])];
    var bits = '101';
    for (var i = 1; i <= 6; i++) {
      bits += (par[i - 1] == 'L' ? _l : _g)[int.parse(d[i])];
    }
    bits += '01010';
    for (var i = 7; i <= 12; i++) {
      bits += _r[int.parse(d[i])];
    }
    bits += '101';
    const q = 9; // quiet zone, modules
    final u = size.width / (95 + 2 * q);
    final paint = Paint()..color = const Color(0xFF000000);
    bool guard(int i) => i < 3 || (i >= 45 && i < 50) || i >= 92;
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] == '1') canvas.drawRect(Rect.fromLTWH((q + i) * u, 0, 1.02 * u, (guard(i) ? 56 : 50) * u), paint);
    }
    void text(String s, double x) {
      final tp = TextPainter(
        text: TextSpan(text: s, style: TextStyle(fontSize: 8 * u, letterSpacing: 1.4 * u, fontFamily: 'monospace', color: const Color(0xFF000000))),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(x * u - tp.width / 2, 56 * u));
    }

    text(d[0], q - 4);
    text(d.substring(1, 7), q + 3 + 21);
    text(d.substring(7), q + 50 + 21);
  }

  @override
  bool shouldRepaint(_BarcodePainter old) => old.digits != digits;
}

// ── the flourish divider (an SVG path on the web) ──

class _FlourishPainter extends CustomPainter {
  _FlourishPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 120; // viewBox 0 0 120 16
    canvas.scale(s);
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..strokeCap = StrokeCap.round;
    final fill = Paint()..color = color;
    canvas.drawLine(const Offset(4, 8), const Offset(40, 8), line..color = color.withValues(alpha: 0.8 * color.a));
    canvas.drawLine(const Offset(80, 8), const Offset(116, 8), line);
    line.color = color;
    canvas.drawPath(
      Path()
        ..moveTo(40, 8)
        ..relativeCubicTo(3, -6, 10, -6, 12, -1)
        ..relativeCubicTo(1, 3, -2, 5, -4, 3)
        ..moveTo(80, 8)
        ..relativeCubicTo(-3, -6, -10, -6, -12, -1)
        ..relativeCubicTo(-1, 3, 2, 5, 4, 3),
      line,
    );
    canvas.drawPath(
      Path()
        ..moveTo(40, 8)
        ..relativeCubicTo(3, 5, 8, 6, 11, 4)
        ..moveTo(80, 8)
        ..relativeCubicTo(-3, 5, -8, 6, -11, 4),
      line..color = color.withValues(alpha: 0.7 * color.a),
    );
    canvas.drawPath(
      Path()
        ..moveTo(60, 3.5)
        ..lineTo(64.5, 8)
        ..lineTo(60, 12.5)
        ..lineTo(55.5, 8)
        ..close(),
      fill,
    );
    canvas.drawCircle(const Offset(2, 8), 1.2, fill);
    canvas.drawCircle(const Offset(118, 8), 1.2, fill);
  }

  @override
  bool shouldRepaint(_FlourishPainter old) => old.color != color;
}

Widget _flourish(Color color, {bool center = true, double topMm = 6}) => Padding(
      padding: EdgeInsets.only(top: _mm(topMm)),
      child: Align(
        alignment: center ? Alignment.center : Alignment.centerLeft,
        child: SizedBox(width: _mm(44), height: _mm(44) * 16 / 120, child: CustomPaint(painter: _FlourishPainter(color))),
      ),
    );

// ── drawing ──

/// What the designer passes to make parts draggable and selectable.
class CoverEditing {
  const CoverEditing({required this.onMove, this.selected, this.onSelect, required this.mmPerPixel});
  final void Function(String id, Offset mm) onMove;
  final String? selected;
  final void Function(String id)? onSelect;

  /// Millimetres per logical pixel of the cover on screen (to turn a drag into millimetres).
  final double mmPerPixel;
}

/// The background picture for a genre background id (see [coverArt]).
ImageProvider coverArtImage(String art) => AssetImage('assets/covers/$art.jpg');

/// A book's front or back cover, [width] logical pixels wide (the height follows 210 × 297).
class CoverView extends StatelessWidget {
  const CoverView({super.key, required this.title, this.subtitle, this.author, required this.cover, this.settings = const {}, this.back = false, required this.width, this.editing, this.forPrint = false});
  final String title;
  final String? subtitle;
  final String? author;
  final Json cover;
  final Json settings;
  final bool back;
  final double width;
  final CoverEditing? editing;

  /// Drawn for a PDF: the background picture is decoded at full size, not at the preview's size.
  final bool forPrint;

  @override
  Widget build(BuildContext context) {
    final c = resolveCover(cover);
    // previews decode the 1500 px background only as large as they show it (desk cards stay light)
    final artWidth = forPrint ? null : (width * MediaQuery.devicePixelRatioOf(context)).ceil().clamp(64, 1500);
    final paint = (bg: coverColor(c['bg']), fg: coverColor(c['fg'], Colors.white), accent: coverColor(c['accent']));
    final art = coverArtId(c['art']);
    final frameOn = c['frame'] == true || (c['frame'] == null && c['template'] == 'kasavu');
    final offsets = (c['offsets'] as Map?)?.cast<String, dynamic>() ?? const {};
    final sizes = (c['sizes'] as Map?)?.cast<String, dynamic>() ?? const {};
    final ctx = _Ctx(c: c, paint: paint, title: title.isEmpty ? 'പുസ്തകം' : title, subtitle: subtitle, author: author ?? '', settings: settings, offsets: offsets, sizes: sizes, editing: editing);

    final layers = <Widget>[
      if (art != null)
        Positioned.fill(
          child: Transform.flip(flipX: back, child: Image.asset('assets/covers/$art.jpg', fit: BoxFit.cover, cacheWidth: artWidth, filterQuality: FilterQuality.medium)),
        ),
      if (art != null && back) Positioned.fill(child: ColoredBox(color: paint.bg.withValues(alpha: 0.62))),
      if (!back && c['template'] == 'photo')
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [paint.bg, paint.bg, paint.bg.withValues(alpha: 0)], stops: const [0, 0.08, 0.6]),
            ),
          ),
        ),
      if (frameOn) ..._frame(paint.accent),
      ...(back ? _back(ctx) : _front(ctx)),
    ];

    return SizedBox(
      width: width,
      height: width * coverH / coverW,
      child: FittedBox(
        fit: BoxFit.fill,
        child: SizedBox(
          width: _mm(coverW),
          height: _mm(coverH),
          child: ClipRect(
            child: DefaultTextStyle(
              style: TextStyle(color: paint.fg, fontFamily: coverFamily(c['font'] as String?), fontFamilyFallback: const ['AnekMalayalam', 'NotoSansMalayalam', 'Inter'], height: 1.2),
              child: ColoredBox(color: paint.bg, child: Stack(clipBehavior: Clip.hardEdge, children: layers)),
            ),
          ),
        ),
      ),
    );
  }
}

typedef _Paint = ({Color bg, Color fg, Color accent});

class _Ctx {
  _Ctx({required this.c, required this.paint, required this.title, required this.subtitle, required this.author, required this.settings, required this.offsets, required this.sizes, required this.editing});
  final Json c;
  final _Paint paint;
  final String title;
  final String? subtitle;
  final String author;
  final Json settings;
  final Map<String, dynamic> offsets;
  final Map<String, dynamic> sizes;
  final CoverEditing? editing;

  double get scale => ((c['titleScale'] as num?) ?? 1).toDouble();
  String? get publisher => (settings['publisher'] as String?)?.trim().isEmpty ?? true ? null : (settings['publisher'] as String).trim();

  List<Shadow>? get shadow => c['titleShadow'] == true
      ? [
          Shadow(color: Colors.black.withValues(alpha: 0.55), offset: Offset(0, _mm(0.5)), blurRadius: _mm(1.2)),
          Shadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: _mm(5)),
        ]
      : null;

  Widget titleText(double pt, {double lh = 1.15, FontWeight weight = FontWeight.w800, TextAlign align = TextAlign.start}) => Text(
        title,
        textAlign: align,
        style: TextStyle(fontSize: _pt(pt * scale), height: lh, fontWeight: weight, shadows: shadow),
      );

  Widget? sub(double pt, {double topMm = 0, double opacity = 0.9, TextAlign align = TextAlign.start}) => (subtitle?.isNotEmpty ?? false)
      ? Padding(
          padding: EdgeInsets.only(top: _mm(topMm)),
          child: Text(subtitle!, textAlign: align, style: TextStyle(fontSize: _pt(pt), color: paint.fg.withValues(alpha: opacity), shadows: shadow)),
        )
      : null;

  /// The divider under the title in the chosen style ("line" is the design's own bar).
  Widget? ornament({required double h, required double w, required double topMm, bool center = true, double bottomMm = 0}) => switch (c['ornament']) {
        'none' => null,
        'flourish' => _flourish(paint.accent, center: center, topMm: topMm),
        _ => Padding(
            padding: EdgeInsets.only(top: _mm(topMm), bottom: _mm(bottomMm)),
            child: Align(alignment: center ? Alignment.center : Alignment.centerLeft, child: Container(width: _mm(w), height: _mm(h), color: paint.accent)),
          ),
      };

  /// The title block's background box (the "Background box" title effect).
  Widget box(Widget child) {
    if (c['titleBox'] != true) return child;
    final color = coverColor(c['titleBoxColor'] ?? c['bg']).withValues(alpha: ((c['titleBoxOpacity'] as num?) ?? 0.75).toDouble());
    return Container(padding: EdgeInsets.symmetric(vertical: _mm(5), horizontal: _mm(6)), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(_mm(2))), child: child);
  }

  /// A part placed like the web's absolute boxes: fractions of the cover from its edges.
  Widget part(String id, Widget child, {double? left, double? right, double? top, double? bottom, bool movable = true}) {
    final o = (offsets[id] as Map?)?.cast<String, dynamic>();
    final size = id == 'title' ? 1.0 : ((sizes[id] as num?) ?? 1).toDouble();
    final placed = movable ? _Movable(id: id, offset: Offset(((o?['x'] as num?) ?? 0).toDouble(), ((o?['y'] as num?) ?? 0).toDouble()), size: size, editing: editing, outline: paint.fg, child: child) : child;
    return Positioned(
      left: left == null ? null : left * _mm(coverW),
      right: right == null ? null : right * _mm(coverW),
      top: top == null ? null : top * _mm(coverH),
      bottom: bottom == null ? null : bottom * _mm(coverH),
      child: placed,
    );
  }
}

List<Widget> _frame(Color color) => [
      Positioned.fill(child: IgnorePointer(child: Container(margin: EdgeInsets.all(_mm(9)), decoration: BoxDecoration(border: Border.all(color: color, width: _mm(1.6)))))),
      Positioned.fill(child: IgnorePointer(child: Container(margin: EdgeInsets.all(_mm(13)), decoration: BoxDecoration(border: Border.all(color: color, width: _mm(0.4)))))),
    ];

Widget _column(List<Widget?> kids, {CrossAxisAlignment cross = CrossAxisAlignment.center}) =>
    Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: cross, children: [for (final k in kids) ?k]);

List<Widget> _front(_Ctx x) {
  final c = x.c;
  final p = x.paint;
  final pub = x.publisher;
  final authorShadow = [Shadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: _mm(2.6))];
  final badgeText = (c['badgeText'] as String?)?.trim().isNotEmpty ?? false ? (c['badgeText'] as String).trim() : (x.settings['edition'] as String?)?.trim();
  final extras = [
    if (c['badge'] == true && (badgeText?.isNotEmpty ?? false))
      x.part(
        'badge',
        Container(
          width: _mm(27),
          height: _mm(27),
          padding: EdgeInsets.all(_mm(3)),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: _mm(3), offset: Offset(0, _mm(1)))]),
          child: Text(badgeText!, textAlign: TextAlign.center, style: TextStyle(color: p.bg, fontSize: _pt(11), fontWeight: FontWeight.w700, height: 1.15)),
        ),
        right: 0.08,
        top: 0.31,
      ),
    if (c['publisherMark'] == true) x.part('mark', PublisherBox(name: pub ?? defaultPublisher, color: p.fg, small: true), right: 0.07, top: 0.045),
  ];

  switch (c['template']) {
    case 'art':
      return [
        x.part(
          'title',
          x.box(_column([
            x.titleText(48, lh: 1.12, align: TextAlign.center),
            x.sub(15, topMm: 4, align: TextAlign.center),
            x.ornament(h: 1, w: 20, topMm: 7),
          ])),
          left: 0.11,
          right: 0.11,
          top: 0.09,
        ),
        x.part(
          'author',
          _column([
            Text(x.author, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(18), fontWeight: FontWeight.w600, letterSpacing: _pt(18) * 0.02, shadows: authorShadow)),
            if (pub != null) Padding(padding: EdgeInsets.only(top: _mm(2)), child: Text(pub, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(9.5), color: p.fg.withValues(alpha: 0.8)))),
          ]),
          left: 0.11,
          right: 0.11,
          bottom: 0.06,
        ),
        ...extras,
      ];
    case 'photo':
      return [
        x.part(
          'title',
          x.box(_column([x.titleText(46), x.sub(15, topMm: 4), x.ornament(h: 1.2, w: 22, topMm: 9, center: false)], cross: CrossAxisAlignment.start)),
          left: 0.12,
          right: 0.12,
          bottom: 0.22,
        ),
        x.part('author', Text(x.author, style: TextStyle(fontSize: _pt(17), fontWeight: FontWeight.w600)), left: 0.12, right: 0.12, bottom: 0.10),
        ...extras,
      ];
    case 'solid':
      return [
        x.part(
          'title',
          x.box(_column([
            if (c['ornament'] != 'flourish') x.ornament(h: 1.4, w: 30, topMm: 0, center: false, bottomMm: 10),
            x.titleText(50, lh: 1.12),
            x.sub(16, topMm: 6, opacity: 0.85),
            if (c['ornament'] == 'flourish') _flourish(p.accent, center: false, topMm: 8),
          ], cross: CrossAxisAlignment.start)),
          left: 0.12,
          right: 0.12,
          top: 0.14,
        ),
        x.part(
          'author',
          Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(child: Text(x.author, style: TextStyle(fontSize: _pt(18), fontWeight: FontWeight.w600))),
            if (pub != null) Text(pub, style: TextStyle(fontSize: _pt(10), color: p.fg.withValues(alpha: 0.75))),
          ]),
          left: 0.12,
          right: 0.12,
          bottom: 0.09,
        ),
        ...extras,
      ];
    case 'type':
      return [
        x.part('author', Text(x.author, style: TextStyle(fontSize: _pt(14), fontWeight: FontWeight.w600, color: p.accent)), left: 0.10, right: 0.10, top: 0.10),
        x.part('title', x.box(_column([x.titleText(92, lh: 1.02), x.ornament(h: 1.4, w: 26, topMm: 7, center: false)], cross: CrossAxisAlignment.start)), left: 0.10, right: 0.10, top: 0.24),
        x.part(
          'subline',
          Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(child: Text(x.subtitle ?? '', style: TextStyle(fontSize: _pt(12), shadows: x.shadow))),
            Text(pub ?? '', style: TextStyle(fontSize: _pt(12), color: p.fg.withValues(alpha: 0.7))),
          ]),
          left: 0.10,
          right: 0.10,
          bottom: 0.10,
          movable: false,
        ),
        ...extras,
      ];
    case 'minimal':
      return [
        x.part(
          'title',
          x.box(_column([x.titleText(30, lh: 1.25, weight: FontWeight.w700, align: TextAlign.center), x.ornament(h: 0.4, w: 16, topMm: 8), x.sub(11, topMm: 4, opacity: 0.75, align: TextAlign.center)])),
          left: 0.14,
          right: 0.14,
          top: 0.36,
        ),
        x.part('author', Text(x.author, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(13))), left: 0.14, right: 0.14, top: 0.58),
        if (pub != null) x.part('pub', Text(pub, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(9), color: p.fg.withValues(alpha: 0.6))), left: 0, right: 0, bottom: 0.10, movable: false),
        ...extras,
      ];
    default: // kasavu
      return [
        x.part(
          'title',
          x.box(_column([x.titleText(44, lh: 1.2, align: TextAlign.center), x.sub(14, topMm: 6, opacity: 0.8, align: TextAlign.center), x.ornament(h: 0.6, w: 18, topMm: 7)])),
          left: 0.16,
          right: 0.16,
          top: 0.24,
        ),
        x.part(
          'author',
          _column([
            Text(x.author, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(17), fontWeight: FontWeight.w600)),
            if (pub != null) Padding(padding: EdgeInsets.only(top: _mm(3)), child: Text(pub, textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(10), color: p.accent))),
          ]),
          left: 0.16,
          right: 0.16,
          bottom: 0.14,
        ),
        ...extras,
      ];
  }
}

/// The author picture for the back cover: an avatar picture, the first letter, or nothing.
Widget? _authorPicture(_Ctx x) {
  final id = x.c['authorAvatar'] as String? ?? 'letter';
  if (id == 'none') return null;
  if (avatarImages.contains(id)) return avatarPicture(id);
  return ColoredBox(
    color: Color.alphaBlend(x.paint.accent.withValues(alpha: 0.22), x.paint.bg),
    child: Center(child: Text(firstLetter(x.author), style: TextStyle(fontFamily: 'AnekMalayalam', fontWeight: FontWeight.w700, fontSize: _mm(18), color: x.paint.accent, height: 1))),
  );
}

List<Widget> _back(_Ctx x) {
  final c = x.c;
  final p = x.paint;
  final head = c['backTitle'] != false;
  final picture = _authorPicture(x);
  final pub = x.publisher ?? defaultPublisher;
  final digits = isbn13(x.settings['isbn']);
  String? text(String k) => (c[k] as String?)?.trim().isEmpty ?? true ? null : c[k] as String;
  const serif = 'NotoSerifMalayalam';
  const ink = Color(0xFF141414);
  final strip = TextStyle(fontSize: _pt(8.5), height: 1.45, color: ink);

  return [
    if (head)
      x.part(
        'back-head',
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (picture != null)
            SizedBox(
              width: _mm(38),
              height: _mm(46),
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned(left: _mm(2.5), top: _mm(2.5), right: -_mm(2.5), bottom: -_mm(2.5), child: ColoredBox(color: p.accent)),
                Positioned.fill(child: Container(decoration: BoxDecoration(border: Border.all(color: Colors.white, width: _mm(1.2)), color: Colors.white), child: ClipRect(child: picture))),
              ]),
            ),
          if (picture != null) SizedBox(width: _mm(7)),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: _mm(2)),
              child: _column([
                Text(x.title, style: TextStyle(fontSize: _pt(24), fontWeight: FontWeight.w800, height: 1.15, color: p.accent)),
                if (x.author.isNotEmpty) Padding(padding: EdgeInsets.only(top: _mm(4)), child: Text(x.author, style: TextStyle(fontSize: _pt(13), fontWeight: FontWeight.w600))),
              ], cross: CrossAxisAlignment.start),
            ),
          ),
        ]),
        left: 0.12,
        right: 0.12,
        top: 0.08,
      ),
    x.part(
      'back-text',
      _column([
        if (text('blurb') != null) Text(text('blurb')!, style: TextStyle(fontFamily: serif, fontSize: _pt(12.5), height: 1.85)),
        if (text('authorBio') != null || (!head && picture != null))
          Padding(
            padding: EdgeInsets.only(top: text('blurb') != null ? _mm(10) : 0),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (!head && picture != null) ...[ClipOval(child: SizedBox.square(dimension: _mm(24), child: picture)), SizedBox(width: _mm(5))],
              Expanded(
                child: _column([
                  if (!head) Text(x.author, style: TextStyle(fontWeight: FontWeight.w700, fontSize: _pt(12), color: p.accent)),
                  if (text('authorBio') != null)
                    Padding(
                      padding: EdgeInsets.only(top: head ? 0 : _mm(2)),
                      child: Text(text('authorBio')!, style: TextStyle(fontFamily: serif, fontSize: _pt(10.5), height: 1.7, color: p.fg.withValues(alpha: 0.9))),
                    ),
                ], cross: CrossAxisAlignment.start),
              ),
            ]),
          ),
      ], cross: CrossAxisAlignment.start),
      left: 0.16,
      right: 0.16,
      top: head ? 0.30 : 0.14,
    ),
    if (c['imprintStrip'] != false)
      x.part(
        'back-imprint',
        Container(
          padding: EdgeInsets.symmetric(vertical: _mm(4), horizontal: _mm(5)),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(_mm(1))),
          child: DefaultTextStyle.merge(
            style: strip,
            child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              PublisherBox(name: pub, tagline: text('publisherTagline'), color: ink),
              SizedBox(width: _mm(4)),
              Expanded(
                child: Container(
                  padding: EdgeInsets.only(left: _mm(4)),
                  decoration: BoxDecoration(border: Border(left: BorderSide(color: const Color(0xFF999999), width: _mm(0.3)))),
                  child: _column([
                    if (text('genreLine') != null) Text(text('genreLine')!.toUpperCase(), style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: _pt(8.5) * 0.04)),
                    if (text('coverCredit') != null) Text(text('coverCredit')!.toUpperCase(), style: TextStyle(letterSpacing: _pt(8.5) * 0.03)),
                    Padding(
                      padding: EdgeInsets.only(top: text('genreLine') != null || text('coverCredit') != null ? _mm(2) : 0),
                      child: _column([
                        Text(pub.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (text('website') != null) Text(text('website')!),
                      ], cross: CrossAxisAlignment.start),
                    ),
                  ], cross: CrossAxisAlignment.start),
                ),
              ),
              SizedBox(width: _mm(4)),
              _column([
                if (text('category') != null) Padding(padding: EdgeInsets.only(bottom: _mm(1.5)), child: Text(text('category')!.toUpperCase(), style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: _pt(8.5) * 0.04))),
                if (digits != null)
                  _column([
                    Text('ISBN ${x.settings['isbn']}', style: TextStyle(fontSize: _pt(6.5), fontFamily: 'monospace', letterSpacing: _pt(6.5) * 0.04)),
                    SizedBox(width: _mm(34), height: _mm(34) * 66 / 113, child: CustomPaint(painter: _BarcodePainter(digits))),
                  ], cross: CrossAxisAlignment.start),
                if (text('price') != null) Padding(padding: EdgeInsets.only(top: _mm(1)), child: Text(text('price')!, style: const TextStyle(fontWeight: FontWeight.w700))),
              ], cross: CrossAxisAlignment.end),
            ]),
          ),
        ),
        left: 0.06,
        right: 0.06,
        bottom: 0.04,
      ),
  ];
}

/// The publisher's boxed mark. Litma Publishing House gets its own two-line lockup; any other
/// name is set in capitals.
class PublisherBox extends StatelessWidget {
  const PublisherBox({super.key, required this.name, this.tagline, required this.color, this.small = false});
  final String name;
  final String? tagline;
  final Color color;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final k = small ? 0.72 : 1.0;
    final litma = name == defaultPublisher;
    return Container(
      constraints: BoxConstraints(maxWidth: _mm(40 * k)),
      padding: EdgeInsets.symmetric(vertical: _mm(2 * k), horizontal: _mm(3 * k)),
      decoration: BoxDecoration(border: Border.all(color: color, width: _mm(0.6 * k))),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontFamily: 'Inter', color: color, height: 1.1),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (litma) ...[
            Text.rich(
              TextSpan(children: [
                const TextSpan(text: 'ലിറ്റ്മ'),
                const TextSpan(text: '.', style: TextStyle(color: Color(0xFF5B3EF0))),
              ]),
              style: TextStyle(fontFamily: 'AnekMalayalam', fontWeight: FontWeight.w800, fontSize: _pt(15 * k), height: 1),
            ),
            Padding(
              padding: EdgeInsets.only(top: _mm(1 * k)),
              child: Text('LITMA PUBLISHING HOUSE', textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(6.2 * k), fontWeight: FontWeight.w800, letterSpacing: _pt(6.2 * k) * 0.14)),
            ),
          ] else
            Text(name.toUpperCase(), textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w800, fontSize: _pt(11 * k), letterSpacing: _pt(11 * k) * 0.04)),
          if (tagline?.isNotEmpty ?? false)
            Padding(
              padding: EdgeInsets.only(top: _mm(1 * k)),
              child: Text(tagline!.toUpperCase(), textAlign: TextAlign.center, style: TextStyle(fontSize: _pt(6.2 * k), letterSpacing: _pt(6.2 * k) * 0.08)),
            ),
        ]),
      ),
    );
  }
}

/// A part that keeps its design position plus the writer's offset, draggable in the designer.
class _Movable extends StatefulWidget {
  const _Movable({required this.id, required this.offset, required this.size, required this.editing, required this.outline, required this.child});
  final String id;
  final Offset offset;
  final double size;
  final CoverEditing? editing;
  final Color outline;
  final Widget child;

  @override
  State<_Movable> createState() => _MovableState();
}

class _MovableState extends State<_Movable> {
  Offset? _live;

  Offset _clamp(Offset v) => Offset(
        ((v.dx.clamp(-coverW, coverW)) * 2).roundToDouble() / 2,
        ((v.dy.clamp(-coverH, coverH)) * 2).roundToDouble() / 2,
      );

  @override
  Widget build(BuildContext context) {
    final o = _live ?? widget.offset;
    final e = widget.editing;
    Widget body = Transform.scale(scale: widget.size, child: widget.child);
    if (e != null) {
      final on = e.selected == widget.id;
      body = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => e.onSelect?.call(widget.id),
        onPanStart: (_) {
          e.onSelect?.call(widget.id);
          setState(() => _live = widget.offset);
        },
        onPanUpdate: (d) => setState(() => _live = _clamp((_live ?? widget.offset) + d.delta * e.mmPerPixel)),
        onPanEnd: (_) {
          final v = _live;
          setState(() => _live = null);
          if (v != null) e.onMove(widget.id, v);
        },
        onPanCancel: () => setState(() => _live = null),
        child: DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: BoxDecoration(border: on ? Border.all(color: widget.outline, width: _mm(0.6)) : null),
          child: body,
        ),
      );
    }
    return Transform.translate(offset: Offset(_mm(o.dx), _mm(o.dy)), child: body);
  }
}
