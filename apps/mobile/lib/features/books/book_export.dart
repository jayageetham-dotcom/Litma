import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/forms.dart';
import '../../data/models.dart';
import '../../editor/document.dart';
import '../../editor/export.dart';
import '../../editor/pdf_fonts.dart';
import '../../widgets/avatar.dart';
import 'cover.dart';

/// A book as PDFs on the phone, the way printers ask for them: the pages (front matter and
/// chapters, laid out by the phone's web engine so Malayalam shapes correctly) and the cover
/// (front and back, drawn by the app at print size). The web's print view (lib/book-sections.ts)
/// is the model; the phone can't number pages, so the contents list has no page numbers and
/// chapters don't wait for a right-hand page.

const _margins = {'top': 22, 'bottom': 24, 'inner': 24, 'outer': 20};

/// The book's page size with its margins (or none, for the cover).
PdfPageFormat bookPageFormat(Json settings, {bool margins = true}) {
  final base = switch (settings['pageSize']) {
    'A5' => PdfPageFormat.a5,
    'Letter' => PdfPageFormat.letter,
    _ => PdfPageFormat.a4,
  };
  if (!margins) return base.copyWith(marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0);
  final m = (settings['margins'] as Map?)?.cast<String, dynamic>() ?? const {};
  double v(String k) => ((m[k] as num?) ?? _margins[k]!).toDouble() * PdfPageFormat.mm;
  return base.copyWith(marginTop: v('top'), marginBottom: v('bottom'), marginLeft: v('inner'), marginRight: v('outer'));
}

bool _hasContent(Object? content) => content is Map && ((content['content'] as List?)?.isNotEmpty ?? false);

/// The pages of [book] as HTML: half-title, title, copyright, dedication, epigraph, contents,
/// parts, text pages and chapters, in the book's order. [docs] are the works it uses (with text).
Future<String> bookInteriorHtml(Book book, Map<String, LitmaDoc> docs) async {
  final st = book.settings;
  final format = bookPageFormat(st);
  final font = (st['font'] as String?) ?? 'Noto Serif Malayalam';
  final size = (st['fontSize'] as num?)?.toDouble() ?? 12;
  final lh = (st['lineHeight'] as num?)?.toDouble() ?? 1.8;
  final pageName = (st['pageSize'] as String?) ?? 'A4';
  final mm = PdfPageFormat.mm;
  // a full page's text area, a little short so it never spills onto a second page
  final fullH = ((format.height - format.marginTop - format.marginBottom) / mm - 3).toStringAsFixed(1);
  final year = (st['year'] as String?)?.trim().isNotEmpty ?? false ? st['year'] as String : '${DateTime.now().year}';
  final esc = htmlText;

  String rich(Object? content) => _hasContent(content) ? docBodyHtml(EditorDocument.fromJson((content as Map).cast<String, dynamic>()), kind: DocKind.blank) : '';
  String full(String cls, String html) => '<div class="full $cls" style="height:${fullH}mm">$html</div>';

  final items = book.structure.where((i) => i['type'] != 'cover' && i['type'] != 'back-cover').toList();
  final pages = <String>[];
  final fonts = <String>{font};
  var chapterNo = 0;

  String itemTitle(Json it) {
    final t = (it['title'] as String?)?.trim() ?? '';
    if (t.isNotEmpty) return t;
    if (it['type'] == 'document') return docs[it['documentId']]?.title ?? '';
    return bookItemLabels[it['type']]?.ml ?? '';
  }

  for (var idx = 0; idx < items.length; idx++) {
    final it = items[idx];
    switch (it['type']) {
      case 'half-title':
        pages.add(full('center', '<p class="ht">${esc(book.title)}</p>'));
      case 'title':
        pages.add(full(
          'center',
          '<h1 class="bt">${esc(book.title)}</h1>'
              '${(book.subtitle?.isNotEmpty ?? false) ? '<p class="bsub">${esc(book.subtitle!)}</p>' : ''}'
              '<p class="by">${esc(book.author ?? '')}</p>'
              '${(st['publisher'] as String?)?.trim().isNotEmpty ?? false ? '<p class="pub">${esc(st['publisher'] as String)}</p>' : ''}',
        ));
      case 'copyright':
        final own = rich(it['content']);
        final auto = [
          '${esc(book.title)}${(book.subtitle?.isNotEmpty ?? false) ? ' — ${esc(book.subtitle!)}' : ''}',
          '© ${esc(year)} ${esc(book.author ?? '')}. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.',
          if ((st['edition'] as String?)?.isNotEmpty ?? false) esc(st['edition'] as String),
          if ((st['isbn'] as String?)?.isNotEmpty ?? false) 'ISBN ${esc(st['isbn'] as String)}',
          if ((st['publisher'] as String?)?.isNotEmpty ?? false) 'പ്രസാധകർ: ${esc(st['publisher'] as String)}',
          'Typeset with Litma',
        ].map((l) => '<p>$l</p>').join();
        pages.add(full('bottom copyright', own.isNotEmpty ? own : auto));
      case 'dedication':
        pages.add(full('center dedication', rich(it['content'])));
      case 'epigraph':
        pages.add(full('third epigraph', rich(it['content'])));
      case 'toc':
        var n = 0;
        final entries = StringBuffer();
        for (var j = 0; j < items.length; j++) {
          final x = items[j];
          final type = x['type'];
          if (x['inToc'] == false) continue;
          if (type != 'document' && type != 'part' && !(type == 'text' && j > idx)) continue;
          if (type == 'document' && docs[x['documentId']] == null) continue;
          entries.write('<li class="toc-$type">${type == 'document' ? '<span class="toc-no">${++n}</span>' : ''}<span>${esc(itemTitle(x))}</span></li>');
        }
        pages.add('<h2 class="chapter">${esc((it['title'] as String?)?.trim().isNotEmpty ?? false ? it['title'] as String : 'ഉള്ളടക്കം')}</h2><ol class="toc">$entries</ol>');
      case 'text':
        pages.add('<h2 class="chapter">${esc((it['title'] as String?) ?? '')}</h2>${rich(it['content'])}');
      case 'part':
        pages.add(full('center part', '<p class="part-k">ഭാഗം</p><h2>${esc((it['title'] as String?) ?? '')}</h2>'));
      case 'document':
        final d = docs[it['documentId']];
        if (d == null) break;
        chapterNo++;
        final showTitle = it['showTitle'] != false;
        final heading = showTitle ? '<h2 class="chapter"><span class="chapter-no">$chapterNo</span>${esc(itemTitle(it))}</h2>' : '';
        final body = docBodyHtml(EditorDocument.fromJson(d.content), kind: d.kind, stripTitle: showTitle);
        final prose = d.kind == DocKind.novel || d.kind == DocKind.story;
        if (prose) {
          pages.add(heading + body);
        } else {
          // poems, screenplays and the rest keep their own type settings, as on the web
          final own = {...settingsFor(d.kind), ...d.settings};
          final f = (own['font'] as String?) ?? font;
          fonts.add(f);
          pages.add('$heading<div style="font-family:\'$f\', \'Noto Serif Malayalam\', serif; font-size:${own['fontSize'] ?? size}pt; line-height:${own['lineHeight'] ?? lh}">$body</div>');
        }
    }
  }

  final m = (st['margins'] as Map?)?.cast<String, dynamic>() ?? const {};
  String margin(String k) => '${(m[k] as num?) ?? _margins[k]}mm';
  return '''<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${esc(book.title)}</title>
<style>
${await fontFaceCss(fonts)}
@page { size: $pageName; margin: ${margin('top')} ${margin('outer')} ${margin('bottom')} ${margin('inner')}; }
body { font-family: '$font', 'Noto Serif Malayalam', serif; font-size: ${size}pt; line-height: $lh; color: #111; text-align: start; margin: 0; }
section + section { page-break-before: always; break-before: page; }
.full { display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
.full.bottom { justify-content: flex-end; }
.full.third { justify-content: flex-start; padding-top: 28%; }
.center { text-align: center; }
.ht { font-size: 1.6em; font-weight: 700; }
.bt { font-size: 2.4em; line-height: 1.25; margin: 0 0 .3em; }
.bsub { font-size: 1.25em; color: #555; margin: 0 0 2.2em; }
.by { font-size: 1.2em; font-weight: 600; margin: 0; }
.pub { margin-top: 5em; color: #555; }
.copyright { font-size: .82em; color: #333; }
.copyright p { margin: 0 0 .35em; }
.dedication { font-style: italic; }
.epigraph { font-style: italic; text-align: right; padding-left: 30%; color: #444; }
h2.chapter { text-align: center; font-size: 1.45em; margin: 1.2em 0 1.6em; }
h2.chapter::after { content: ""; display: block; width: 3em; height: 2px; margin: .55em auto 0; background: #a84d08; }
.chapter-no { display: block; font-size: .7em; color: #a84d08; margin-bottom: .3em; }
ol.toc { list-style: none; padding: 0; margin: 0; }
ol.toc li { display: flex; gap: .8em; padding: .35em 0; border-bottom: 1px dotted #bbb; }
.toc-no { min-width: 1.6em; color: #a84d08; }
li.toc-part { font-weight: 700; margin-top: .6em; }
.part-k { color: #a84d08; letter-spacing: .1em; }
.part h2 { font-size: 2em; margin: .2em 0 0; }
$exportCss
</style></head><body>${pages.map((p) => '<section>$p</section>').join()}</body></html>''';
}

/// Draws the front and back covers at print size while showing them, then hands back a PDF of the
/// two pages (no margins). Returns null if the writer closed it.
Future<Uint8List?> buildCoverPdf(BuildContext context, Book book) => showDialog<Uint8List>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _CoverCapture(book: book),
    );

class _CoverCapture extends StatefulWidget {
  const _CoverCapture({required this.book});
  final Book book;

  @override
  State<_CoverCapture> createState() => _CoverCaptureState();
}

class _CoverCaptureState extends State<_CoverCapture> {
  final _front = GlobalKey();
  final _back = GlobalKey();

  /// Width of each cover picture in pixels: about 210 dpi on A4, 300 dpi on A5.
  static const _px = 1748;
  static const _preview = 92.0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  Future<void> _run() async {
    final cover = widget.book.cover;
    try {
      // the pictures must be decoded before they are drawn, or the PDF gets an empty background
      final art = coverArtId(resolveCover(cover)['art']);
      if (art != null) await precacheImage(coverArtImage(art), context);
      final face = cover['authorAvatar'];
      if (face is String && avatarImages.contains(face) && mounted) await precacheImage(AssetImage('assets/avatars/avatar-$face.png'), context).catchError((_) {});
      if (!mounted) return;
      setState(() {});
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await WidgetsBinding.instance.endOfFrame;
      final pages = <(Uint8List, int, int)>[];
      for (final key in [_front, _back]) {
        final boundary = key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
        if (boundary == null) throw StateError('cover not drawn');
        final image = await boundary.toImage(pixelRatio: _px / boundary.size.width);
        final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        pages.add((data!.buffer.asUint8List(), image.width, image.height));
        image.dispose();
      }
      final format = bookPageFormat(widget.book.settings, margins: false);
      final doc = pw.Document(title: widget.book.title, author: widget.book.author, creator: 'Litma');
      for (final (rgba, w, h) in pages) {
        doc.addPage(pw.Page(
          pageFormat: format,
          margin: pw.EdgeInsets.zero,
          build: (_) => pw.SizedBox(width: format.width, height: format.height, child: pw.Image(pw.RawImage(bytes: rgba, width: w, height: h), fit: pw.BoxFit.cover)),
        ));
      }
      final bytes = await doc.save();
      if (mounted) Navigator.pop(context, bytes);
    } catch (_) {
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final b = widget.book;
    Widget cover(GlobalKey key, bool back) => RepaintBoundary(
          key: key,
          child: CoverView(title: b.title, subtitle: b.subtitle, author: b.author, cover: b.cover, settings: b.settings, back: back, width: _preview, forPrint: true),
        );
    return AlertDialog(
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [cover(_front, false), const SizedBox(width: 12), cover(_back, true)]),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: c.accent)),
          const SizedBox(width: 10),
          Flexible(child: Text(context.t('app.books.preparing'))),
        ]),
      ]),
    );
  }
}

/// Opens a PDF the app made, with the system's print and share buttons.
Future<void> showBookPdf(BuildContext context, {required String title, required PdfPageFormat format, required FutureOr<Uint8List> Function() build}) =>
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (context) => Scaffold(
        appBar: AppBar(title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis)),
        body: PdfPreview(
          canChangeOrientation: false,
          canChangePageFormat: false,
          canDebug: false,
          initialPageFormat: format,
          pdfFileName: '${title.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim()}.pdf',
          build: (_) => build(),
        ),
      ),
    ));
