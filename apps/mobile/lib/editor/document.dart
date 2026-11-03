import 'dart:convert';

import '../data/forms.dart' show Json;

/// The editor's model of a work, read from and written back to the same Tiptap JSON the web
/// and desktop apps use. Nothing is ever dropped: blocks and inline pieces this editor can't
/// edit yet travel through unchanged.
///
///  - [TextBlock]: a textblock (paragraph, heading, styled block, screenplay line…) whose inline
///    text is editable. Text marks (bold, colour, links, anything else) are kept per character.
///  - [GroupBlock]: a container of blocks (dialogue, cast entry, quote, list); its text children
///    are editable in place.
///  - [OpaqueBlock]: anything else (page break, rule, image, table…), kept as raw JSON.
sealed class Block {
  Block(this.type, this.attrs);
  String type;
  Json attrs;

  Json toJson();

  /// Plain text (for word counts and excerpts).
  String get plainText;

  static Block fromJson(Json j) {
    final type = j['type'] as String? ?? 'paragraph';
    final attrs = (j['attrs'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final kids = (j['content'] as List?)?.cast<Map>().map((m) => m.cast<String, dynamic>()).toList() ?? const <Json>[];
    if (_textblockTypes.contains(type) || (kids.isNotEmpty && kids.every(_isInline))) {
      return TextBlock.fromInline(type, attrs, kids, extra: _extraKeys(j));
    }
    if (_groupTypes.contains(type) && kids.isNotEmpty && kids.every((k) => !_isInline(k))) {
      return GroupBlock(type, attrs, [for (final k in kids) Block.fromJson(k)], extra: _extraKeys(j));
    }
    if (kids.isEmpty && !_opaqueLeafTypes.contains(type)) {
      // an empty textblock of a type this editor doesn't list (a new block from the web): editable
      return TextBlock.fromInline(type, attrs, const [], extra: _extraKeys(j));
    }
    return OpaqueBlock(j);
  }
}

/// Keys other than type/attrs/content (kept as they are).
Json _extraKeys(Json j) => {for (final e in j.entries) if (!const {'type', 'attrs', 'content'}.contains(e.key)) e.key: e.value};

const _textblockTypes = {
  'paragraph', 'heading', 'styledBlock', 'codeBlock',
  // screenplay and play lines
  'sceneHeading', 'sceneTime', 'sceneCast', 'action', 'transition', 'dialogueCue', 'dialogueSpeech', 'castName', 'castRole',
};
const _groupTypes = {'dialogue', 'castEntry', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem'};
const _opaqueLeafTypes = {'pageBreak', 'horizontalRule', 'image', 'table', 'endnotes'};

bool _isInline(Json n) => n['type'] == 'text' || _inlineAtoms.contains(n['type']) || n['type'] == 'hardBreak';
const _inlineAtoms = {'footnote', 'mention', 'emoji', 'image', 'inlineImage', 'math'};

/// Characters standing in for inline pieces inside the editable text.
const hardBreakChar = ' ';
const atomChar = '￼';

/// A set of text marks, exactly as stored ([{type: bold}, {type: textStyle, attrs: {...}}…]).
/// Instances are shared and compared by [key].
class MarkSet {
  MarkSet._(this.marks, this.key);
  final List<Json> marks;
  final String key;

  static final empty = MarkSet._(const [], '[]');
  static final _cache = <String, MarkSet>{'[]': empty};

  static MarkSet of(List<Json> marks) {
    if (marks.isEmpty) return empty;
    final key = jsonEncode(marks);
    return _cache.putIfAbsent(key, () => MarkSet._(List.unmodifiable(marks), key));
  }

  bool has(String type) => marks.any((m) => m['type'] == type);
  Json? get(String type) => marks.where((m) => m['type'] == type).firstOrNull;

  MarkSet add(Json mark) => of([...marks.where((m) => m['type'] != mark['type']), mark]);
  MarkSet remove(String type) => of(marks.where((m) => m['type'] != type).toList());

  /// textStyle attribute (color, fontSize, fontWeight…) if set.
  String? style(String attr) => get('textStyle')?['attrs']?[attr] as String?;
}

/// An editable line of text: its characters, each character's marks, and inline pieces.
class TextBlock extends Block {
  TextBlock(super.type, super.attrs, {this.text = '', List<MarkSet>? marks, Map<int, Json>? atoms, Json? extra})
      : marks = marks ?? List.filled(text.length, MarkSet.empty, growable: true),
        atoms = atoms ?? {},
        extra = extra ?? {};

  /// Visible text; hard line breaks are [hardBreakChar], inline pieces [atomChar].
  String text;

  /// One entry per UTF-16 unit of [text].
  List<MarkSet> marks;

  /// The raw JSON of each inline piece, by its position in [text] (marks are kept with it).
  Map<int, Json> atoms;
  Json extra;

  factory TextBlock.fromInline(String type, Json attrs, List<Json> inline, {Json? extra}) {
    final b = StringBuffer();
    final marks = <MarkSet>[];
    final atoms = <int, Json>{};
    for (final n in inline) {
      final m = MarkSet.of(((n['marks'] as List?) ?? const []).cast<Map>().map((x) => x.cast<String, dynamic>()).toList());
      if (n['type'] == 'text') {
        final s = (n['text'] as String?) ?? '';
        b.write(s);
        marks.addAll(List.filled(s.length, m));
      } else if (n['type'] == 'hardBreak' && n.keys.every((k) => k == 'type' || k == 'marks')) {
        b.write(hardBreakChar);
        marks.add(m);
      } else {
        atoms[b.length] = n;
        b.write(atomChar);
        marks.add(MarkSet.empty);
      }
    }
    return TextBlock(type, attrs, text: b.toString(), marks: marks, atoms: atoms, extra: extra);
  }

  bool get isEmpty => text.isEmpty;
  String? get variant => attrs['variant'] as String?;
  String? get align => attrs['textAlign'] as String?;

  @override
  String get plainText => text.replaceAll(hardBreakChar, '\n').replaceAll(atomChar, '');

  List<Json> inlineJson() {
    final out = <Json>[];
    var i = 0;
    while (i < text.length) {
      final ch = text[i];
      if (ch == atomChar && atoms.containsKey(i)) {
        out.add(atoms[i]!);
        i++;
        continue;
      }
      if (ch == hardBreakChar) {
        final m = marks[i];
        out.add({'type': 'hardBreak', if (m.marks.isNotEmpty) 'marks': m.marks});
        i++;
        continue;
      }
      final m = marks[i];
      var j = i + 1;
      while (j < text.length && marks[j] == m && text[j] != hardBreakChar && !(text[j] == atomChar && atoms.containsKey(j))) {
        j++;
      }
      out.add({'type': 'text', 'text': text.substring(i, j), if (m.marks.isNotEmpty) 'marks': m.marks});
      i = j;
    }
    return out;
  }

  @override
  Json toJson() {
    final inline = inlineJson();
    return {'type': type, if (attrs.isNotEmpty) 'attrs': attrs, if (inline.isNotEmpty) 'content': inline, ...extra};
  }

  /// Replace this block's content (text, marks, pieces) with another's.
  void setFrom(TextBlock other) {
    text = other.text;
    marks = [...other.marks];
    atoms = {...other.atoms};
  }

  /// Split at [at]: this keeps the text before, the returned block gets the text after.
  TextBlock splitAt(int at, {String? type, Json? attrs}) {
    final after = TextBlock(
      type ?? this.type,
      attrs ?? {...this.attrs},
      text: text.substring(at),
      marks: marks.sublist(at),
      atoms: {for (final e in atoms.entries) if (e.key >= at) e.key - at: e.value},
    );
    text = text.substring(0, at);
    marks = marks.sublist(0, at);
    atoms.removeWhere((k, _) => k >= at);
    return after;
  }

  /// Append another block's content at the end of this one.
  void append(TextBlock other) {
    final base = text.length;
    text += other.text;
    marks.addAll(other.marks);
    for (final e in other.atoms.entries) {
      atoms[base + e.key] = e.value;
    }
  }
}

class GroupBlock extends Block {
  GroupBlock(super.type, super.attrs, this.children, {Json? extra}) : extra = extra ?? {};
  final List<Block> children;
  final Json extra;

  @override
  String get plainText => children.map((c) => c.plainText).join(type == 'dialogue' ? '\n' : '');

  @override
  Json toJson() => {'type': type, if (attrs.isNotEmpty) 'attrs': attrs, 'content': [for (final c in children) c.toJson()], ...extra};

  Iterable<TextBlock> get textChildren sync* {
    for (final c in children) {
      if (c is TextBlock) yield c;
      if (c is GroupBlock) yield* c.textChildren;
    }
  }
}

class OpaqueBlock extends Block {
  OpaqueBlock(this.json) : super(json['type'] as String? ?? 'unknown', (json['attrs'] as Map?)?.cast<String, dynamic>() ?? {});
  final Json json;

  @override
  String get plainText => _plain(json);

  static String _plain(Json n) {
    if (n['type'] == 'text') return (n['text'] as String?) ?? '';
    return ((n['content'] as List?) ?? const []).cast<Map>().map((m) => _plain(m.cast<String, dynamic>())).join(' ');
  }

  @override
  Json toJson() => json;
}

/// A whole work: its top-level blocks plus anything else on the doc node.
class EditorDocument {
  EditorDocument(this.blocks, {Json? extra}) : extra = extra ?? {};
  final List<Block> blocks;
  final Json extra;

  factory EditorDocument.fromJson(Json doc) {
    final kids = ((doc['content'] as List?) ?? const []).cast<Map>().map((m) => m.cast<String, dynamic>()).toList();
    final blocks = [for (final k in kids) Block.fromJson(k)];
    if (blocks.isEmpty) blocks.add(TextBlock('paragraph', {}));
    return EditorDocument(blocks, extra: _extraKeys(doc));
  }

  Json toJson() => {'type': 'doc', 'content': [for (final b in blocks) b.toJson()], ...extra};

  String get plainText => blocks.map((b) => b.plainText).join('\n');
}
