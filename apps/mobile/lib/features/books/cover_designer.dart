import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n.dart';
import '../../core/keyboard.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../widgets/avatar.dart';
import '../../widgets/common.dart';
import 'cover.dart';
import '../../data/analytics.dart';

/// The cover designer, the phone version of the web's CoverDesigner (apps/web/src/app/book/page.tsx):
/// the cover stays in view at the top (tap a text to size it, drag it to move it) and the tools
/// scroll below. Every change goes to [onCover] at once (the book screen saves it shortly after).
class CoverDesignerScreen extends StatefulWidget {
  const CoverDesignerScreen({super.key, required this.book, required this.onCover, this.back = false});
  final Book book;
  final void Function(Json patch) onCover;
  final bool back;

  static Route<void> route({required Book book, required void Function(Json patch) onCover, bool back = false}) =>
      MaterialPageRoute(builder: (_) => CoverDesignerScreen(book: book, onCover: onCover, back: back));

  @override
  State<CoverDesignerScreen> createState() => _CoverDesignerScreenState();
}

class _CoverDesignerScreenState extends State<CoverDesignerScreen> {
  late Json _cover = {...widget.book.cover};
  late bool _back = widget.back;
  String? _part;
  final _fields = <String, TextEditingController>{};

  Json get _c => resolveCover(_cover);
  String get _template => _c['template'] as String;

  void _set(Json patch) {
    setState(() => _cover = {..._cover, ...patch});
    widget.onCover(patch);
  }

  @override
  void initState() {
    super.initState();
    Analytics.screen('/book/cover/');
  }

  TextEditingController _field(String key) => _fields.putIfAbsent(key, () => TextEditingController(text: (_cover[key] as String?) ?? ''));

  @override
  void dispose() {
    for (final f in _fields.values) {
      f.dispose();
    }
    super.dispose();
  }

  List<String> get _parts => _back ? coverPartsBack : coverPartsFront;
  String get _sizePart => _part != null && _parts.contains(_part) ? _part! : (_back ? 'back-text' : 'title');

  double get _partSize => _sizePart == 'title' ? ((_cover['titleScale'] as num?) ?? 1).toDouble() : (((_cover['sizes'] as Map?)?[_sizePart] as num?) ?? 1).toDouble();

  void _setPartSize(double v) => _sizePart == 'title'
      ? _set({'titleScale': v})
      : _set({
          'sizes': {...((_cover['sizes'] as Map?)?.cast<String, dynamic>() ?? const {}), _sizePart: v},
        });

  Map<String, dynamic> get _offsets => (_cover['offsets'] as Map?)?.cast<String, dynamic>() ?? const {};

  bool get _moved => _parts.any((k) {
        final o = _offsets[k] as Map?;
        return o != null && (((o['x'] as num?) ?? 0) != 0 || ((o['y'] as num?) ?? 0) != 0);
      });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final media = MediaQuery.sizeOf(context);
    // the cover keeps about two fifths of the screen; the tools scroll beneath it
    final previewH = math.min(media.height * 0.4, 420.0);
    final previewW = previewH * coverW / coverH;
    final b = widget.book;
    return Scaffold(
      appBar: AppBar(title: Text(context.t('cover.design'))),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: SegmentTabs(
            labels: [context.t('cover.front'), context.t('cover.back')],
            index: _back ? 1 : 0,
            onChanged: (i) => setState(() {
              _back = i == 1;
              _part = null;
            }),
          ),
        ),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _part = null),
          child: SizedBox(
            width: double.infinity,
            height: previewH,
            child: Center(
              child: DecoratedBox(
                decoration: BoxDecoration(boxShadow: [BoxShadow(color: const Color(0xFF111113).withValues(alpha: 0.22), blurRadius: 18, offset: const Offset(0, 6))]),
                child: CoverView(
                  title: b.title,
                  subtitle: b.subtitle,
                  author: b.author,
                  cover: _cover,
                  settings: b.settings,
                  back: _back,
                  width: previewW,
                  editing: CoverEditing(
                    mmPerPixel: coverW / previewW,
                    selected: _part,
                    onSelect: (id) => setState(() => _part = id),
                    onMove: (id, mm) => _set({
                      'offsets': {..._offsets, id: {'x': mm.dx, 'y': mm.dy}},
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 12, 4),
          child: Row(children: [
            Expanded(child: Text(context.t('cover.moveHintTouch'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted))),
            if (_moved)
              TextButton.icon(
                onPressed: () => _set({
                  'offsets': {for (final e in _offsets.entries) if (!_parts.contains(e.key)) e.key: e.value},
                }),
                icon: const Icon(LucideIcons.rotateCcw, size: 15),
                label: Text(context.t('cover.resetPositions')),
              ),
          ]),
        ),
        Divider(height: 1, color: c.line),
        Expanded(
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
            children: _back ? _backTools(context) : _frontTools(context),
          ),
        ),
      ]),
    );
  }

  // ── pieces ──

  Widget _section(BuildContext context, String label, Widget child, {Color? tint, Widget? trailing}) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: tint ?? c.tintViolet, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: c.muted))),
          ?trailing,
        ]),
        const SizedBox(height: 10),
        child,
      ]),
    );
  }

  Widget _chip(BuildContext context, String label, bool on, VoidCallback onTap) {
    final c = context.c;
    return Pressable(
      onTap: onTap,
      semanticLabel: label,
      child: AnimatedContainer(
        duration: Motion.of(context, Motion.fast),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
          color: on ? c.accentSoft : c.surface,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: on ? c.accent : c.lineStrong),
        ),
        child: Text(label, style: TextStyle(fontSize: 13.5, fontWeight: on ? FontWeight.w600 : FontWeight.w500, color: on ? c.optionSelectedInk : c.ink)),
      ),
    );
  }

  Widget _sizeCard(BuildContext context) {
    final c = context.c;
    final v = _partSize;
    final max = _sizePart == 'title' ? 2.0 : 2.5;
    final label = context.t('cover.fontSizeOf', {'part': context.t('cover.part.$_sizePart')});
    return Container(
      margin: const EdgeInsets.only(bottom: 22),
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 6),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: c.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
          Text('${(v * 100).round()}%', style: TextStyle(color: c.muted, fontFeatures: const [FontFeature.tabularFigures()])),
          if (v != 1) IconButton(tooltip: context.t('cover.resetSize'), onPressed: () => _setPartSize(1), icon: const Icon(LucideIcons.rotateCcw, size: 16)),
        ]),
        Slider(value: v.clamp(0.5, max), min: 0.5, max: max, divisions: ((max - 0.5) / 0.05).round(), label: '${(v * 100).round()}%', onChanged: _setPartSize),
      ]),
    );
  }

  Widget _colours(BuildContext context) {
    final c = context.c;
    final paint = _c;
    Widget swatch(String key) {
      final colour = coverColor(paint[key]);
      return Expanded(
        child: Pressable(
          semanticLabel: context.t('cover.colour.$key'),
          onTap: () async {
            final picked = await pickCoverColour(context, '${paint[key]}');
            if (picked != null) _set({key: picked, 'preset': null});
          },
          child: Column(children: [
            Container(height: 40, decoration: BoxDecoration(color: colour, borderRadius: BorderRadius.circular(10), border: Border.all(color: c.lineStrong))),
            const SizedBox(height: 5),
            Text(context.t('cover.colour.$key'), style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
      );
    }

    return _section(context, context.t('cover.colours'), Row(children: [swatch('bg'), const SizedBox(width: 10), swatch('fg'), const SizedBox(width: 10), swatch('accent')]), tint: c.tintCoral);
  }

  Widget _input(BuildContext context, String key, String label, {String? hint, int lines = 1, bool malayalam = true}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: _field(key),
          onTapOutside: dismissKeyboard,
          minLines: lines,
          maxLines: lines == 1 ? 1 : lines + 4,
          style: malayalam ? const TextStyle(fontFamily: LitmaFonts.sans, fontFamilyFallback: ['Inter']) : null,
          decoration: InputDecoration(labelText: label, hintText: hint, alignLabelWithHint: lines > 1),
          onChanged: (v) => _set({key: v}),
        ),
      );

  // ── front cover ──

  List<Widget> _frontTools(BuildContext context) {
    final c = context.c;
    final cv = _c;
    final b = widget.book;
    final frameOn = cv['frame'] == true || (cv['frame'] == null && _template == 'kasavu');
    final art = coverArtId(cv['art']);
    final font = (cv['font'] as String?) ?? 'Anek Malayalam';
    return [
      _section(
        context,
        context.t('cover.presetsTitle'),
        SizedBox(
          height: 158,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: coverPresets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final id = coverPresets.keys.elementAt(i);
              final on = _cover['preset'] == id;
              return Pressable(
                semanticLabel: context.t('cover.presets.$id'),
                onTap: () {
                  Haptics.tap();
                  _set(presetPatch(id));
                },
                child: Column(children: [
                  AnimatedContainer(
                    duration: Motion.of(context, Motion.fast),
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: on ? c.accent : Colors.transparent, width: 2)),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(5),
                      child: IgnorePointer(
                        child: CoverView(
                          title: b.title,
                          subtitle: b.subtitle,
                          author: b.author,
                          cover: {..._cover, ...presetPatch(id), 'badge': false, 'publisherMark': false},
                          settings: b.settings,
                          width: 88,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(context.t('cover.presets.$id'), style: TextStyle(fontSize: 12, fontWeight: on ? FontWeight.w600 : FontWeight.w400, color: on ? c.accent : c.muted)),
                ]),
              );
            },
          ),
        ),
        tint: c.tintViolet,
      ),
      _sizeCard(context),
      _section(
        context,
        context.t('cover.layout'),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final id in coverLayouts)
            Pressable(
              semanticLabel: context.t('cover.layouts.$id'),
              onTap: () => _set({'template': id, 'frame': frameOn, 'offsets': <String, dynamic>{}, 'sizes': <String, dynamic>{}, 'titleScale': 1, 'preset': null}),
              child: SizedBox(
                width: 62,
                child: Column(children: [
                  AnimatedContainer(
                    duration: Motion.of(context, Motion.fast),
                    width: 52,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(7), border: Border.all(color: _template == id ? c.accent : c.lineStrong, width: 2)),
                    child: AspectRatio(aspectRatio: 44 / 62, child: CustomPaint(painter: _LayoutIcon(id, _template == id ? c.accent : c.muted))),
                  ),
                  const SizedBox(height: 4),
                  Text(context.t('cover.layouts.$id'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, height: 1.15, fontWeight: _template == id ? FontWeight.w600 : FontWeight.w400, color: _template == id ? c.accent : c.muted)),
                ]),
              ),
            ),
        ]),
        tint: c.tintSky,
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(context.t('cover.frame'), style: Theme.of(context).textTheme.bodySmall),
          Switch(value: frameOn, onChanged: (v) => _set({'frame': v})),
        ]),
      ),
      _colours(context),
      _section(
        context,
        context.t('cover.titleFont'),
        SizedBox(
          height: 70,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: coverFonts.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final f = coverFonts[i];
              final on = f.$1 == font;
              return Pressable(
                semanticLabel: f.$1,
                onTap: () => _set({'font': f.$1, 'preset': null}),
                child: AnimatedContainer(
                  duration: Motion.of(context, Motion.fast),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(color: on ? c.optionSelected : c.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: on ? c.accent : c.line)),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('പുസ്തകം', style: TextStyle(fontFamily: f.$3, fontSize: 20, height: 1.2, color: on ? c.optionSelectedInk : c.ink)),
                    Text('${f.$1} · ${context.t('cover.fontKind.${f.$2}')}', style: TextStyle(fontSize: 11, color: c.muted)),
                  ]),
                ),
              );
            },
          ),
        ),
        tint: c.tintTangerine,
      ),
      _section(
        context,
        context.t('cover.titleEffects'),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            _chip(context, context.t('cover.shadow'), cv['titleShadow'] == true, () => _set({'titleShadow': cv['titleShadow'] != true})),
            _chip(context, context.t('cover.box'), cv['titleBox'] == true, () => _set({'titleBox': cv['titleBox'] != true})),
          ]),
          if (cv['titleBox'] == true)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(children: [
                Pressable(
                  semanticLabel: context.t('cover.boxColour'),
                  onTap: () async {
                    final picked = await pickCoverColour(context, '${cv['titleBoxColor'] ?? cv['bg']}');
                    if (picked != null) _set({'titleBoxColor': picked});
                  },
                  child: Column(children: [
                    Container(width: 44, height: 36, decoration: BoxDecoration(color: coverColor(cv['titleBoxColor'] ?? cv['bg']), borderRadius: BorderRadius.circular(8), border: Border.all(color: c.lineStrong))),
                    const SizedBox(height: 3),
                    Text(context.t('cover.boxColour'), style: Theme.of(context).textTheme.bodySmall),
                  ]),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(context.t('cover.boxStrength'), style: Theme.of(context).textTheme.bodySmall),
                    Slider(value: ((cv['titleBoxOpacity'] as num?) ?? 0.75).toDouble().clamp(0.2, 1.0), min: 0.2, max: 1, divisions: 16, onChanged: (v) => _set({'titleBoxOpacity': v})),
                  ]),
                ),
              ]),
            ),
        ]),
        tint: c.tintLime,
      ),
      _section(
        context,
        context.t('cover.illustration'),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2 / 3,
            children: [
              if (_template != 'art')
                _artTile(
                  context,
                  on: art == null,
                  label: context.t('cover.none'),
                  onTap: () => _set({'art': null}),
                  child: ColoredBox(
                    color: coverColor(cv['bg']),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: c.surface.withValues(alpha: 0.85), borderRadius: BorderRadius.circular(4)),
                        child: Text(context.t('cover.none'), style: TextStyle(fontSize: 11, color: c.muted)),
                      ),
                    ),
                  ),
                ),
              for (final e in coverArt.entries)
                _artTile(
                  context,
                  on: art == e.key,
                  label: context.t('cover.art.${e.key}'),
                  onTap: () => _set({'art': e.key, 'bg': e.value.$1, 'fg': e.value.$2, 'accent': e.value.$3, 'preset': null}),
                  child: Image(image: ResizeImage(coverArtImage(e.key), width: 180), fit: BoxFit.cover),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(context.t('cover.artHint'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
        ]),
        tint: c.tintSky,
      ),
      _section(
        context,
        context.t('cover.ornament'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final o in const ['line', 'flourish', 'none']) _chip(context, context.t('cover.ornaments.$o'), ((cv['ornament'] as String?) ?? 'line') == o, () => _set({'ornament': o})),
        ]),
        tint: c.tintCoral,
      ),
      _section(
        context,
        context.t('cover.extras'),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            _chip(context, context.t('cover.badge'), cv['badge'] == true, () => _set({'badge': cv['badge'] != true})),
            _chip(context, context.t('cover.publisherMark'), cv['publisherMark'] == true, () => _set({'publisherMark': cv['publisherMark'] != true})),
          ]),
          if (cv['badge'] == true) Padding(padding: const EdgeInsets.only(top: 12), child: _input(context, 'badgeText', context.t('cover.badgeText'), hint: (b.settings['edition'] as String?) ?? '14-ാം പതിപ്പ്')),
        ]),
        tint: c.tintViolet,
      ),
      Text(context.t('cover.fromDetails'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
    ];
  }

  Widget _artTile(BuildContext context, {required bool on, required String label, required VoidCallback onTap, required Widget child}) {
    final c = context.c;
    return Pressable(
      semanticLabel: label,
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.of(context, Motion.fast),
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: on ? c.accent : Colors.transparent, width: 2)),
        child: ClipRRect(borderRadius: BorderRadius.circular(5), child: SizedBox.expand(child: child)),
      ),
    );
  }

  // ── back cover ──

  List<Widget> _backTools(BuildContext context) {
    final c = context.c;
    final cv = _c;
    final b = widget.book;
    final picked = (cv['authorAvatar'] as String?) ?? 'letter';
    final paint = (bg: coverColor(cv['bg']), accent: coverColor(cv['accent']));

    Widget avatarChoice(String id, String label) {
      final on = picked == id;
      final Widget face = switch (id) {
        'none' => Container(
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.lineStrong)),
            child: Icon(LucideIcons.x, size: 16, color: c.muted),
          ),
        'letter' => Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Color.alphaBlend(paint.accent.withValues(alpha: 0.18), paint.bg)),
            child: Text(firstLetter(b.author ?? ''), style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: 17, color: paint.accent, height: 1)),
          ),
        _ => ClipOval(child: avatarPicture(id)),
      };
      return Pressable(
        semanticLabel: label,
        onTap: () => _set({'authorAvatar': id, 'authorPhoto': null}),
        child: AnimatedContainer(
          duration: Motion.of(context, Motion.fast),
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: on ? c.accent : Colors.transparent, width: 2)),
          child: SizedBox.square(dimension: 42, child: face),
        ),
      );
    }

    return [
      Wrap(spacing: 8, runSpacing: 8, children: [
        _chip(context, context.t('cover.backTitle'), cv['backTitle'] != false, () => _set({'backTitle': cv['backTitle'] == false})),
        _chip(context, context.t('cover.imprintStrip'), cv['imprintStrip'] != false, () => _set({'imprintStrip': cv['imprintStrip'] == false})),
      ]),
      const SizedBox(height: 18),
      _sizeCard(context),
      _colours(context),
      _input(context, 'blurb', context.t('cover.blurb'), hint: 'ഈ പുസ്തകത്തെക്കുറിച്ച്…', lines: 5),
      _input(context, 'authorBio', context.t('cover.authorBio'), lines: 3),
      _section(
        context,
        context.t('cover.authorPicture'),
        Wrap(spacing: 6, runSpacing: 6, children: [
          avatarChoice('none', context.t('cover.none')),
          avatarChoice('letter', context.t('cover.letter')),
          for (final id in avatarImages) avatarChoice(id, context.t('avatar.picture', {'n': avatarImages.indexOf(id) + 1})),
        ]),
        tint: c.tintLime,
      ),
      _input(context, 'price', context.t('cover.price'), hint: '₹ 250', malayalam: false),
      _section(
        context,
        context.t('cover.imprint'),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _input(context, 'genreLine', context.t('cover.genreLine'), hint: 'മലയാളം നോവൽ'),
          _input(context, 'category', context.t('cover.category'), hint: 'Fiction'),
          _input(context, 'coverCredit', context.t('cover.coverCredit'), hint: 'Cover design: …'),
          _input(context, 'publisherTagline', context.t('cover.publisherTagline')),
          _input(context, 'website', context.t('cover.website'), hint: 'www.example.com', malayalam: false),
        ]),
        tint: c.tintTangerine,
      ),
      Text(context.t('cover.imprintHint'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted)),
    ];
  }
}

/// Wireframe of a cover layout (the web's LayoutIcon: bars on a 44 × 62 page).
class _LayoutIcon extends CustomPainter {
  _LayoutIcon(this.id, this.color);
  final String id;
  final Color color;

  static const _bars = <String, List<(double, double, double, double, double)>>{
    'art': [(9, 8, 26, 5, 1), (14, 15, 16, 2.5, 0.6), (14, 54, 16, 3, 0.8)],
    'kasavu': [(9, 17, 26, 5, 1), (14, 24, 16, 2.5, 0.6), (14, 48, 16, 3, 0.8)],
    'solid': [(6, 7, 10, 2, 0.6), (6, 11, 28, 5, 1), (6, 18, 18, 2.5, 0.6), (6, 54, 16, 3, 0.8)],
    'type': [(6, 6, 12, 2.5, 0.8), (6, 15, 30, 9, 1), (6, 26, 22, 9, 1)],
    'minimal': [(9, 25, 26, 5, 1), (17, 32, 10, 1.5, 0.6), (14, 38, 16, 3, 0.8)],
    'photo': [(6, 38, 28, 5, 1), (6, 45, 18, 2.5, 0.6), (6, 52, 16, 3, 0.8)],
  };

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 44, size.height / 62);
    canvas.drawRRect(RRect.fromLTRBR(0.5, 0.5, 43.5, 61.5, const Radius.circular(2)), Paint()..color = color.withValues(alpha: 0.08 * color.a));
    for (final (x, y, w, h, o) in _bars[id] ?? const <(double, double, double, double, double)>[]) {
      canvas.drawRRect(RRect.fromLTRBR(x, y, x + w, y + h, Radius.circular(h / 2)), Paint()..color = color.withValues(alpha: o * color.a));
    }
  }

  @override
  bool shouldRepaint(_LayoutIcon old) => old.id != id || old.color != color;
}

/// Colours offered first: the backgrounds' own sets, then calm neutrals and inks.
const _palette = [
  '#0b2f3a', '#1d5a52', '#1d2a44', '#0b2350', '#050a1f', '#0a0e13', '#151b18', '#3b1f1a',
  '#5a2238', '#a3372b', '#c8102e', '#b5546f', '#f6c9cf', '#e7a85a', '#e9c46a', '#d2ad5c',
  '#a8875a', '#a17a28', '#8a5a2b', '#4fe3ff', '#ffb15a', '#3d4232', '#1a2220', '#1f2421',
  '#efe9dc', '#f7f3e8', '#e9e1cf', '#faf7f0', '#fbecd0', '#fdf6e3', '#e9fbff', '#ffffff',
];

/// A colour for the cover: the palette, or any colour code (#rrggbb). Returns null when closed.
Future<String?> pickCoverColour(BuildContext context, String current) => showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ColourSheet(current: current),
    );

class _ColourSheet extends StatefulWidget {
  const _ColourSheet({required this.current});
  final String current;

  @override
  State<_ColourSheet> createState() => _ColourSheetState();
}

class _ColourSheetState extends State<_ColourSheet> {
  late final _code = TextEditingController(text: RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(widget.current) ? widget.current : '');

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _submit() {
    final v = _code.text.trim();
    final hex = v.startsWith('#') ? v : '#$v';
    if (RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) Navigator.pop(context, hex.toLowerCase());
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final current = widget.current.toLowerCase();
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(context.t('cover.pickColour'), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 14),
        GridView.count(
          crossAxisCount: 8,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          children: [
            for (final hex in _palette)
              Pressable(
                semanticLabel: hex,
                onTap: () => Navigator.pop(context, hex),
                child: Container(
                  decoration: BoxDecoration(
                    color: coverColor(hex),
                    shape: BoxShape.circle,
                    border: Border.all(color: hex == current ? c.accent : c.lineStrong, width: hex == current ? 3 : 1),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _code,
              onTapOutside: dismissKeyboard,
              autocorrect: false,
              decoration: InputDecoration(labelText: context.t('cover.hex'), hintText: '#1d5a52', isDense: true),
              onSubmitted: (_) => _submit(),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(onPressed: _submit, child: const Icon(LucideIcons.check, size: 18)),
        ]),
      ]),
    );
  }
}
