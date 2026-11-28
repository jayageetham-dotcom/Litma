import 'dart:convert';
import 'dart:typed_data';

import '../core/zip.dart';
import '../data/forms.dart';

/// Word (.docx) files on the phone: a port of the web's writer (apps/web/src/lib/export.ts:
/// `docxBlob`, `journalsDocxBlob`, `docxBody`, `packDocx`), so a file looks the same whichever app
/// made it. Works from the Tiptap JSON the apps share. Body text ragged-right (justified only when
/// the writer chose it), novels and stories indent like a printed book, footnotes are real Word
/// footnotes, the writer's own font sizes are kept.

const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/// One work as a Word file.
Uint8List workDocx({required String title, required DocKind kind, required Json settings, required Json content}) {
  final w = _Writer();
  final s = _settings(kind, settings);
  final body = w.body(kind, s, content);
  return w.pack(title, s, body);
}

/// Several journals in one Word file, in the order given (oldest first): the title, a contents page
/// listing each journal's [entry] (date line, and title when named), then each journal on a new page.
Uint8List journalsDocx(List<({DocKind kind, Json settings, Json content, String entry})> docs, {required String title, required String contents}) {
  final w = _Writer();
  final s = _settings(DocKind.diary, docs.isEmpty ? const {} : docs.first.settings);
  final body = StringBuffer()
    ..write(_p(jc: 'center', after: 360, runs: _run(title, bold: true, size: _pt(20))))
    ..write(_p(after: 200, runs: _run(contents, bold: true, size: _pt(14))));
  for (final (i, d) in docs.indexed) {
    body.write(_p(after: 80, runs: _run('${i + 1}.  ${d.entry}')));
  }
  for (final d in docs) {
    body.write(_pageBreak);
    body.write(w.body(d.kind, _settings(d.kind, d.settings), d.content));
  }
  return w.pack(title, s, body.toString());
}

/// The writing type's settings under the work's own (as `settingsFor(kind)` + settings on the web).
Json _settings(DocKind kind, Json own) => {...settingsFor(kind), ...own};

int _pt(num v) => (v * 2).round(); // half-points

String _x(String s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const _w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const _pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/// A run of text with its formatting (b, i, strike, colour, size, underline in the schema's order).
String _run(String text, {bool bold = false, bool italics = false, bool underline = false, bool strike = false, int? size, String? color}) {
  final pr = StringBuffer();
  if (bold) pr.write('<w:b/><w:bCs/>');
  if (italics) pr.write('<w:i/><w:iCs/>');
  if (strike) pr.write('<w:strike/>');
  if (color != null) pr.write('<w:color w:val="$color"/>');
  if (size != null) pr.write('<w:sz w:val="$size"/><w:szCs w:val="$size"/>');
  if (underline) pr.write('<w:u w:val="single"/>');
  return '<w:r>${pr.isEmpty ? '' : '<w:rPr>$pr</w:rPr>'}<w:t xml:space="preserve">${_x(text)}</w:t></w:r>';
}

/// A paragraph: spacing in twentieths of a point, indents in twips, alignment left/center/right/both.
String _p({required String runs, String? jc, int? before, int? after, int? line, int? firstLine, int? left, int? right, int? hanging, String? style, String? border}) {
  final pr = StringBuffer();
  if (style != null) pr.write('<w:pStyle w:val="$style"/>');
  if (border != null) pr.write('<w:pBdr>$border</w:pBdr>');
  if (before != null || after != null || line != null) {
    pr.write('<w:spacing${before != null ? ' w:before="$before"' : ''}${after != null ? ' w:after="$after"' : ''}${line != null ? ' w:line="$line" w:lineRule="auto"' : ''}/>');
  }
  if (firstLine != null || left != null || right != null || hanging != null) {
    pr.write('<w:ind${left != null ? ' w:left="$left"' : ''}${right != null ? ' w:right="$right"' : ''}${hanging != null ? ' w:hanging="$hanging"' : ''}${firstLine != null ? ' w:firstLine="$firstLine"' : ''}/>');
  }
  if (jc != null) pr.write('<w:jc w:val="$jc"/>');
  return '<w:p>${pr.isEmpty ? '' : '<w:pPr>$pr</w:pPr>'}$runs</w:p>';
}

const _align = {'left': 'left', 'center': 'center', 'right': 'right', 'justify': 'both'};

const _noBorders = '<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>';

class _Writer {
  /// Footnotes met while writing the body, numbered from 1.
  final notes = <String>[];

  /// The text runs of a block (its inline content), with [bold]/[italics]/[size] as the base.
  String runs(Object? n, {bool bold = false, bool italics = false, int? size, String? color}) {
    final out = StringBuffer();
    void walk(Object? c) {
      if (c is! Map) return;
      final type = c['type'];
      if (type == 'hardBreak') {
        out.write('<w:r><w:br/></w:r>');
        return;
      }
      if (type == 'footnote') {
        notes.add('${(c['attrs'] as Map?)?['text'] ?? ''}');
        out.write('<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${notes.length}"/></w:r>');
        return;
      }
      if (type != 'text') {
        for (final k in (c['content'] as List? ?? const [])) {
          walk(k);
        }
        return;
      }
      final marks = (c['marks'] as List? ?? const []).whereType<Map>().toList();
      final names = {for (final m in marks) m['type']};
      // the writer's own font size (toolbar), in points
      final fs = marks.where((m) => m['type'] == 'textStyle').map((m) => (m['attrs'] as Map?)?['fontSize']).firstOrNull;
      final own = double.tryParse(RegExp(r'^\s*([\d.]+)').firstMatch('${fs ?? ''}')?.group(1) ?? '');
      out.write(_run('${c['text'] ?? ''}',
          bold: bold || names.contains('bold'),
          italics: italics || names.contains('italic'),
          underline: names.contains('underline'),
          strike: names.contains('strike'),
          size: own != null && own > 0 ? _pt(own) : size,
          color: color));
    }

    walk(n);
    return out.toString();
  }

  String body(DocKind kind, Json s, Json content) {
    final out = StringBuffer();
    final fontSize = (s['fontSize'] as num?)?.toDouble() ?? 12;
    final lineHeight = (s['lineHeight'] as num?)?.toDouble() ?? 1.75;
    var scene = 0, chapter = 0, act = 0, dscene = 0, stanza = 0;
    final en = s['headingLabels'] == 'en';
    // numbered headings read the way the work shows them on screen
    final sceneLabel = kind == DocKind.screenplay ? (s['headingLabels'] == 'ml' ? 'രംഗം ' : en ? 'Scene ' : 'Scene: ') : en ? 'Scene ' : 'രംഗം ';
    final prose = kind == DocKind.novel || kind == DocKind.story;
    String label(String text, [double? size]) => _p(jc: 'center', before: 360, after: 60, runs: _run(text, bold: true, size: _pt(size ?? fontSize - 1)));
    String pair(Object? left, Object? right, {required int leftPct, required int rightPct, required String alignLeft, required bool boldLeft, required bool colon, bool pad = false}) {
      String cell(int pct, String p) => '<w:tc><w:tcPr><w:tcW w:w="${pct * 50}" w:type="pct"/><w:tcBorders>$_noBorders</w:tcBorders></w:tcPr>$p</w:tc>';
      final cols = [leftPct, rightPct, if (pad) 100 - leftPct - rightPct];
      return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>$_noBorders<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>'
          '<w:tblGrid>${cols.map((c) => '<w:gridCol w:w="${(c * 90).round()}"/>').join()}</w:tblGrid><w:tr>'
          '${cell(leftPct, _p(jc: alignLeft, runs: runs(left, bold: boldLeft) + (colon ? _run(':') : '')))}'
          '${cell(rightPct, _p(runs: runs(right)))}'
          '${pad ? cell(100 - leftPct - rightPct, _p(runs: '')) : ''}'
          '</w:tr></w:tbl>';
    }

    bool filled(Object? b) => b is Map && ((b['content'] as List?)?.isNotEmpty ?? false);
    final blocks = (content['content'] as List? ?? const []).whereType<Map>().toList();
    for (final (i, n) in blocks.indexed) {
      final attrs = (n['attrs'] as Map?) ?? const {};
      final align = _align[attrs['textAlign']];
      // novels and stories indent like the editor: not the first paragraph, not after a heading or
      // a break, and an empty line is a section break (it and the paragraph after it sit at the margin)
      final before = i > 0 ? blocks[i - 1] : null;
      final indentHere = prose && filled(n) && before?['type'] == 'paragraph' && filled(before);
      final kids = n['content'] as List? ?? const [];
      switch (n['type']) {
        case 'heading':
          final level = ((attrs['level'] as num?)?.toInt() ?? 1).clamp(1, 3);
          out.write(_p(style: 'Heading$level', jc: align, runs: runs(n)));
        case 'styledBlock':
          final v = '${attrs['variant'] ?? ''}';
          final hasText = kids.isNotEmpty;
          if (v == 'act') {
            dscene = 0;
            out.write(label('${en ? 'Act' : 'അങ്കം'} ${++act}', fontSize + 4));
            if (hasText) out.write(_p(jc: 'center', after: 240, runs: runs(n, bold: true, size: _pt(fontSize + 2))));
            continue;
          }
          if (v == 'scene') {
            out.write(label('${en ? 'Scene' : 'രംഗം'} ${++dscene}', fontSize + 2));
            if (hasText) out.write(_p(jc: 'center', after: 200, runs: runs(n)));
            continue;
          }
          if (v == 'stanza') {
            out.write(label('${++stanza}'));
            if (hasText) out.write(_p(jc: 'center', runs: runs(n, italics: true)));
            continue;
          }
          if (v == 'chapter') {
            chapter++;
            if (prose && s['chapterNumbers'] == true) out.write(label('${en ? 'Chapter' : 'അദ്ധ്യായം'} $chapter'));
          }
          if (v == 'infobox') {
            const line = '<w:top w:val="single" w:sz="6" w:space="1" w:color="B8B8C0"/><w:left w:val="single" w:sz="6" w:space="4" w:color="B8B8C0"/><w:bottom w:val="single" w:sz="6" w:space="1" w:color="B8B8C0"/><w:right w:val="single" w:sz="6" w:space="4" w:color="B8B8C0"/>';
            out.write(_p(border: line, before: 200, after: 200, runs: runs(n, size: _pt(fontSize - 0.5))));
            continue;
          }
          if (v == 'refrain') {
            out.write(_p(left: 400, runs: _run('↻ ') + runs(n, italics: true)));
            continue;
          }
          final center = const ['title', 'subtitle', 'author', 'chapter', 'pullquote', 'caption'].contains(v);
          final big = switch (v) {
            'title' => 20.0,
            'chapter' => 16.0,
            'pullquote' => 15.0,
            'subhead' || 'references' => 13.5,
            'credits' => fontSize - 2,
            'epigraph' => fontSize - 1,
            _ => fontSize,
          };
          out.write(_p(
            jc: center ? 'center' : (v == 'epigraph' ? 'right' : align),
            before: v == 'chapter' ? 480 : 120,
            after: v == 'title' || v == 'chapter' ? 360 : 120,
            runs: runs(n, bold: const ['title', 'chapter', 'subhead', 'pullquote', 'references'].contains(v), italics: const ['stage', 'epigraph'].contains(v), size: _pt(big)),
          ));
        case 'sceneHeading':
          out.write(_p(before: 360, runs: _run('$sceneLabel${++scene}', bold: true, size: _pt(fontSize + 3))));
          out.write(_p(runs: runs(n, bold: true)));
        case 'sceneTime':
          out.write(_p(runs: runs(n)));
        case 'sceneCast':
          out.write(_p(jc: 'right', after: 200, runs: runs(n, size: _pt(fontSize - 1))));
        case 'action':
          out.write(_p(right: 4200, after: 160, runs: runs(n)));
        case 'transition':
          out.write(_p(jc: 'right', runs: runs(n, bold: true)));
        case 'dialogue':
          final sp = kind == DocKind.screenplay;
          out.write(pair(kids.isNotEmpty ? kids[0] : null, kids.length > 1 ? kids[1] : null, leftPct: sp ? 46 : 20, rightPct: sp ? 44 : 80, alignLeft: sp ? 'right' : 'left', boldLeft: !sp, colon: true, pad: sp));
        case 'castEntry':
          out.write(pair(kids.isNotEmpty ? kids[0] : null, kids.length > 1 ? kids[1] : null, leftPct: 28, rightPct: 72, alignLeft: 'left', boldLeft: true, colon: false));
        case 'pageBreak':
          out.write(_pageBreak);
        case 'horizontalRule':
          out.write(_p(jc: 'center', before: 200, after: 200, runs: _run('⁂')));
        case 'blockquote':
          for (final c in kids) {
            out.write(_p(left: 720, runs: runs(c, italics: true)));
          }
        case 'bulletList' || 'orderedList':
          for (final (j, li) in kids.indexed) {
            out.write(_p(left: 540, hanging: 300, runs: _run(n['type'] == 'orderedList' ? '${j + 1}. ' : '• ') + runs(li)));
          }
        default:
          // ragged-right like the editor; justified only when the writer chose it
          out.write(_p(jc: align, firstLine: indentHere ? 400 : null, after: prose ? 40 : 140, line: (lineHeight * 240).round(), runs: runs(n)));
      }
    }
    return out.toString();
  }

  /// The .docx package: the body in a page of the work's size and margins, the default font and
  /// size, and the footnotes.
  Uint8List pack(String title, Json s, String body) {
    const sizes = {'A4': (210.0, 297.0), 'A5': (148.0, 210.0), 'Letter': (215.9, 279.4), 'Legal': (215.9, 355.6)};
    final (pw, ph) = sizes[s['pageSize']] ?? sizes['A4']!;
    int tw(num mm) => (mm / 25.4 * 1440).round();
    final m = (s['margins'] as Map?) ?? const {};
    int margin(String k) => tw((m[k] as num?) ?? 25);
    final font = _x('${s['font'] ?? 'Noto Serif Malayalam'}');
    final fontSize = (s['fontSize'] as num?)?.toDouble() ?? 12;
    final size = _pt(fontSize);

    final document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document $_w xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>$body'
        '<w:sectPr><w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr><w:pgSz w:w="${tw(pw)}" w:h="${tw(ph)}"/>'
        '<w:pgMar w:top="${margin('top')}" w:right="${margin('right')}" w:bottom="${margin('bottom')}" w:left="${margin('left')}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
        '</w:body></w:document>';

    final fonts = '<w:rFonts w:ascii="$font" w:hAnsi="$font" w:cs="$font" w:eastAsia="$font"/>';
    String heading(int level, double pt) => '<w:style w:type="paragraph" w:styleId="Heading$level"><w:name w:val="heading $level"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
        '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${_pt(pt)}"/><w:szCs w:val="${_pt(pt)}"/></w:rPr></w:style>';
    final styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:styles $_w><w:docDefaults><w:rPrDefault><w:rPr>$fonts<w:sz w:val="$size"/><w:szCs w:val="$size"/><w:lang w:val="ml-IN" w:bidi="ml-IN"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        '${heading(1, 16)}${heading(2, 14)}${heading(3, 13)}'
        '<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="${_pt(fontSize - 2)}"/><w:szCs w:val="${_pt(fontSize - 2)}"/></w:rPr></w:style>'
        '<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>'
        '</w:styles>';

    final footnotes = StringBuffer('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes $_w>'
        '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
        '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>');
    for (final (i, t) in notes.indexed) {
      footnotes.write('<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>'
          '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${_run(' $t', size: _pt(fontSize - 2))}</w:p></w:footnote>');
    }
    footnotes.write('</w:footnotes>');

    const settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:settings $_w><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '</Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '</Relationships>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>'
        '</Relationships>';
    final core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>${_x(title)}</dc:title><dc:creator>Litma</dc:creator></cp:coreProperties>';

    List<int> b(String s) => utf8.encode(s);
    return zip([
      ('[Content_Types].xml', b(types)),
      ('_rels/.rels', b(rels)),
      ('docProps/core.xml', b(core)),
      ('word/document.xml', b(document)),
      ('word/styles.xml', b(styles)),
      ('word/settings.xml', b(settings)),
      ('word/footnotes.xml', b(footnotes.toString())),
      ('word/_rels/document.xml.rels', b(docRels)),
    ]);
  }
}
