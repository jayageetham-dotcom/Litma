import 'dart:convert';

import '../data/forms.dart';
import 'document.dart';

/// HTML for a work (PDF through the system print sheet, and a Word-compatible .doc). Same look as
/// the web's renderDocHtml in spirit: the writing type's fonts, titles centred, chapters with the
/// accent rule, body ragged-right, dialogue in two columns. Books reuse [docBodyHtml] and
/// [exportCss] (features/books/book_export.dart).
///
/// [fontsCss] is the `@font-face` rules from fontFaceCss (pdf_fonts.dart), so the PDF uses the app's
/// own fonts on every phone; a Word file leaves it empty.
String docToHtml(EditorDocument doc, {required String title, required DocKind kind, required Json settings, String fontsCss = ''}) {
  final font = (settings['font'] as String?) ?? 'Noto Serif Malayalam';
  final size = (settings['fontSize'] as num?)?.toDouble() ?? 12;
  final lh = (settings['lineHeight'] as num?)?.toDouble() ?? 1.75;
  final page = (settings['pageSize'] as String?) ?? 'A4';
  return '''<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${htmlText(title)}</title>
<style>
$fontsCss@page { size: $page; margin: 25mm; }
body { font-family: '$font', 'Noto Serif Malayalam', serif; font-size: ${size}pt; line-height: $lh; color: #111; text-align: start; margin: 0; }
$exportCss
</style></head><body>${docBodyHtml(doc, kind: kind)}</body></html>''';
}

const _esc = HtmlEscape(HtmlEscapeMode.element);

/// Text made safe for HTML.
String htmlText(String s) => _esc.convert(s);

/// Styles for [docBodyHtml]. Rules that belong to one writing type are scoped by the wrapper's
/// classes (`prose`, `k-drama`), so a book can hold works of different types.
const exportCss = '''
p { margin: 0 0 .5em; }
.prose p.paragraph { margin: 0 0 .15em; }
.prose p.paragraph + p.paragraph { text-indent: 1.6em; }
/* an empty line is a section break: a gap, and the next paragraph starts at the margin (editor.scss) */
p.gap { margin-top: 1em; }
.prose p.paragraph.gap { text-indent: 0; }
.sb-title { font-size: 2.05em; font-weight: 700; text-align: center; margin: .4em 0 .25em; }
.sb-subtitle { font-size: 1.2em; text-align: center; color: #555; }
.sb-author { text-align: center; margin-bottom: 1.6em; }
.sb-epigraph { font-style: italic; text-align: right; margin: 1em 0 1.6em 35%; color: #555; font-size: .9em; }
.sb-chapter { text-align: center; font-size: 1.35em; font-weight: 700; margin: 2.4em 0 1.4em; }
.sb-chapter::after { content: ""; display: block; width: 3em; height: 2px; margin: .55em auto 0; background: #a84d08; }
.sb-subhead { font-size: 1.15em; font-weight: 700; margin: 1.2em 0 .35em; }
.sb-stage { font-style: italic; margin-left: 2.5em; }
.sb-act, .sb-scene, .sb-stanza { text-align: center; font-weight: 700; }
.num { color: #a84d08; font-size: .85em; }
.sp-scene { font-weight: 700; margin-top: 1.8em; }
.sceneCast { text-align: right; font-size: .88em; }
.transition { text-align: right; font-weight: 600; }
table.dlg { width: 100%; border-collapse: collapse; margin: 0 0 .7em; }
table.dlg td { vertical-align: top; padding: 0 .5em 0 0; }
td.cue { width: 30%; text-align: right; font-weight: 600; }
.k-drama td.cue { text-align: left; }
sup.fn { font-size: .7em; color: #a84d08; }
.notes { margin-top: 2.4em; padding-top: .8em; border-top: 1px solid #bbb; font-size: .88em; }
.notes-h { font-weight: 700; margin-bottom: .5em; }
.notes ol { margin: 0; padding-left: 1.6em; }
''';

/// A work's body inside `<div class="doc k-<kind>">`. [stripTitle] leaves out the work's own title,
/// subtitle, author and byline lines (a book shows a chapter heading instead). Footnotes are
/// numbered in order and listed after the body ("കുറിപ്പുകൾ"), like the web.
String docBodyHtml(EditorDocument doc, {required DocKind kind, bool stripTitle = false}) {
  final body = StringBuffer();
  final notes = <String>[];
  var scene = 0, act = 0, dscene = 0, stanza = 0;
  // an empty line was skipped: the next paragraph starts a new section
  var gap = false;

  String inline(TextBlock b) {
    final out = StringBuffer();
    for (final n in b.inlineJson()) {
      if (n['type'] == 'hardBreak') {
        out.write('<br>');
        continue;
      }
      if (n['type'] != 'text') {
        if (n['type'] == 'footnote') {
          notes.add('${(n['attrs'] as Map?)?['text'] ?? ''}');
          out.write('<sup class="fn">${notes.length}</sup>');
        }
        continue;
      }
      var t = htmlText('${n['text']}');
      for (final m in ((n['marks'] as List?) ?? const []).cast<Map>()) {
        switch (m['type']) {
          case 'bold':
            t = '<b>$t</b>';
          case 'italic':
            t = '<i>$t</i>';
          case 'underline':
            t = '<u>$t</u>';
          case 'strike':
            t = '<s>$t</s>';
          case 'superscript':
            t = '<sup>$t</sup>';
          case 'subscript':
            t = '<sub>$t</sub>';
          case 'textStyle':
            final c = (m['attrs'] as Map?)?['color'];
            final fs = (m['attrs'] as Map?)?['fontSize'];
            if (c != null || fs != null) t = '<span style="${c != null ? 'color:$c;' : ''}${fs != null ? 'font-size:$fs;' : ''}">$t</span>';
          case 'highlight':
            final c = (m['attrs'] as Map?)?['color'];
            t = c == null ? '<mark>$t</mark>' : '<mark style="background:$c">$t</mark>';
        }
      }
      out.write(t);
    }
    return out.toString();
  }

  void block(Block b) {
    if (b is OpaqueBlock) {
      if (b.type == 'pageBreak') body.write('<div style="page-break-after:always"></div>');
      if (b.type == 'horizontalRule') body.write('<hr>');
      gap = false;
      return;
    }
    if (b is GroupBlock) {
      if (b.type == 'dialogue' || b.type == 'castEntry') {
        final kids = b.textChildren.toList();
        final cue = kids.isNotEmpty ? inline(kids[0]) : '';
        final rest = kids.skip(1).map(inline).join('<br>');
        body.write('<table class="dlg"><tr><td class="cue">$cue${b.type == 'dialogue' && cue.isNotEmpty ? ':' : ''}</td><td>$rest</td></tr></table>');
      } else if (b.type == 'bulletList' || b.type == 'orderedList') {
        final tag = b.type == 'bulletList' ? 'ul' : 'ol';
        body.write('<$tag>');
        for (final item in b.children) {
          body.write('<li>');
          if (item is GroupBlock) {
            body.write(item.textChildren.map(inline).join('<br>'));
          } else if (item is TextBlock) {
            body.write(inline(item));
          }
          body.write('</li>');
        }
        body.write('</$tag>');
      } else {
        for (final c in b.children) {
          block(c);
        }
      }
      gap = false;
      return;
    }
    final t = b as TextBlock;
    if (t.isEmpty && t.type == 'paragraph') {
      gap = true;
      return;
    }
    final align = t.align == null ? '' : ' style="text-align:${t.align}"';
    final h = inline(t);
    final g = gap ? ' gap' : '';
    gap = false;
    switch (t.type) {
      case 'styledBlock':
        final v = t.variant ?? 'subhead';
        if (stripTitle && const {'title', 'subtitle', 'author', 'byline'}.contains(v)) return;
        String? label;
        if (v == 'act') label = 'അങ്കം ${++act}';
        if (v == 'scene') label = 'രംഗം ${++dscene}';
        if (v == 'stanza') label = '${++stanza}';
        if (v == 'act') dscene = 0;
        if (t.isEmpty && label == null) return;
        body.write('<p class="sb sb-$v$g"$align>${label != null ? '<span class="num">$label</span><br>' : ''}$h</p>');
      case 'sceneHeading':
        body.write('<p class="sp-scene$g"><span class="num">രംഗം ${++scene}</span><br>$h</p>');
      case 'heading':
        final level = (t.attrs['level'] as num?)?.toInt() ?? 2;
        body.write('<h$level$align>$h</h$level>');
      default:
        body.write('<p class="${t.type}$g"$align>$h</p>');
    }
  }

  for (final b in doc.blocks) {
    block(b);
  }
  if (notes.isNotEmpty) {
    body.write('<div class="notes"><p class="notes-h">കുറിപ്പുകൾ</p><ol>${notes.map((n) => '<li>${htmlText(n)}</li>').join()}</ol></div>');
  }
  final prose = kind == DocKind.novel || kind == DocKind.story;
  return '<div class="doc k-${kind.name}${prose ? ' prose' : ''}">$body</div>';
}
