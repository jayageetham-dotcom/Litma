import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/akshara.dart';
import 'package:litma/core/manglish.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/editor/block_controller.dart';
import 'package:litma/editor/document.dart';

/// A work written on the web with everything the phone editor must keep intact.
final Json richDoc = {
  'type': 'doc',
  'content': [
    {
      'type': 'styledBlock',
      'attrs': {'textAlign': null, 'variant': 'title'},
      'content': [
        {'type': 'text', 'text': 'മഴ'}
      ]
    },
    {
      'type': 'paragraph',
      'attrs': {'textAlign': 'justify'},
      'content': [
        {'type': 'text', 'text': 'ഒന്ന് '},
        {
          'type': 'text',
          'text': 'കനത്ത',
          'marks': [
            {'type': 'bold'},
            {
              'type': 'textStyle',
              'attrs': {'color': '#c2410c', 'fontSize': '14pt', 'fontFamily': null}
            }
          ]
        },
        {'type': 'text', 'text': ' മഴ'},
        {'type': 'hardBreak'},
        {'type': 'text', 'text': 'രണ്ടാം വരി'},
        {
          'type': 'footnote',
          'attrs': {'text': 'ഒരു കുറിപ്പ്'}
        },
        {
          'type': 'text',
          'text': 'link',
          'marks': [
            {
              'type': 'link',
              'attrs': {'href': 'https://getlitma.in', 'target': '_blank'}
            }
          ]
        },
      ]
    },
    {'type': 'pageBreak'},
    {
      'type': 'dialogue',
      'content': [
        {
          'type': 'dialogueCue',
          'content': [
            {'type': 'text', 'text': 'ഉമ്മ'}
          ]
        },
        {'type': 'dialogueSpeech'}
      ]
    },
    {
      'type': 'table',
      'content': [
        {
          'type': 'tableRow',
          'content': [
            {
              'type': 'tableCell',
              'attrs': {'colspan': 1},
              'content': [
                {
                  'type': 'paragraph',
                  'content': [
                    {'type': 'text', 'text': 'cell'}
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      'type': 'bulletList',
      'content': [
        {
          'type': 'listItem',
          'content': [
            {
              'type': 'paragraph',
              'content': [
                {'type': 'text', 'text': 'ഒന്ന്'}
              ]
            }
          ]
        }
      ]
    },
    {'type': 'someFutureBlock', 'attrs': {'x': 1}},
  ],
};

TextStyle _styler(MarkSet m, TextStyle b) => m.has('bold') ? b.copyWith(fontWeight: FontWeight.w700) : b;

BlockController _controller(TextBlock b, {List<String>? log, InputMode mode = InputMode.manglish}) => BlockController(
      block: b,
      styler: _styler,
      mode: mode,
      onSplit: (c, at) => log?.add('split@$at'),
      onMergeBack: (c) => log?.add('merge'),
      onChanged: (c, {required textChanged}) {},
    );

/// Type [s] one character at a time at the cursor, as a keyboard does.
void type(BlockController c, String s) {
  for (final ch in s.split('')) {
    final v = c.value;
    final at = v.selection.extentOffset;
    c.value = TextEditingValue(text: v.text.substring(0, at) + ch + v.text.substring(at), selection: TextSelection.collapsed(offset: at + 1));
  }
}

void backspace(BlockController c) {
  final v = c.value;
  final at = v.selection.extentOffset;
  c.value = TextEditingValue(text: v.text.substring(0, at - 1) + v.text.substring(at), selection: TextSelection.collapsed(offset: at - 1));
}

void main() {
  group('Manglish engine matches the web', () {
    final vectors = (jsonDecode(File('test/manglish_vectors.json').readAsStringSync()) as Map).cast<String, String>();
    for (final e in vectors.entries) {
      if (e.key == '__phrase__') continue;
      test(e.key, () => expect(manglishWord(e.key), e.value));
    }
    test('phrase', () => expect(manglish('ente naadu, nammude kadha!'), vectors['__phrase__']));
  });

  group('documents survive a round trip unchanged', () {
    test('every writing type\'s starter', () {
      for (final k in DocKind.values) {
        final j = starterContent(k, now: DateTime(2026, 11, 3));
        expect(EditorDocument.fromJson(j).toJson(), j, reason: k.name);
      }
    });
    test('a rich work from the web (marks, breaks, footnote, page break, dialogue, table, list, unknown block)', () {
      final out = EditorDocument.fromJson(richDoc).toJson();
      expect(jsonEncode(out), jsonEncode(richDoc));
    });
    test('editing one block leaves every other block byte-identical', () {
      final d = EditorDocument.fromJson(richDoc);
      final title = d.blocks.first as TextBlock;
      title
        ..text = 'വെയിൽ'
        ..marks = List.filled(5, MarkSet.empty, growable: true);
      final out = d.toJson()['content'] as List;
      final orig = richDoc['content'] as List;
      for (var i = 1; i < orig.length; i++) {
        expect(jsonEncode(out[i]), jsonEncode(orig[i]));
      }
    });
    test('plain text matches the web (blocks on their own lines)', () {
      expect(EditorDocument.fromJson(starterContent(DocKind.lyrics)).plainText, contains('പല്ലവി\n'));
    });
  });

  group('typing', () {
    test('Manglish words turn into Malayalam at the space', () {
      final c = _controller(TextBlock('paragraph', {}));
      type(c, 'ente naadu ');
      expect(c.block.text, 'എന്റെ നാദു ');
      expect(c.blockSelection.extentOffset, c.block.text.length);
    });
    test('the space takes the spelling the suggestion strip shows first', () {
      final c = BlockController(
        block: TextBlock('paragraph', {}),
        styler: _styler,
        spelling: (w) => w == 'naadu' ? 'നാട്' : null,
        onSplit: (c, at) {},
        onMergeBack: (c) {},
        onChanged: (c, {required textChanged}) {},
      );
      type(c, 'ente naadu ');
      expect(c.block.text, 'എന്റെ നാട് ');
      expect(c.blockSelection.extentOffset, c.block.text.length);
    });
    test('"Keep English" leaves the word as typed', () {
      final c = _controller(TextBlock('paragraph', {}));
      type(c, 'Litma');
      c.keepEnglish = 'Litma';
      type(c, ' ');
      expect(c.block.text, 'Litma ');
    });
    test('English mode never converts', () {
      final c = _controller(TextBlock('paragraph', {}), mode: InputMode.english);
      type(c, 'ente ');
      expect(c.block.text, 'ente ');
    });
    test('Enter splits instead of adding a line break', () {
      final log = <String>[];
      final c = _controller(TextBlock('paragraph', {}), log: log, mode: InputMode.english);
      type(c, 'ab');
      c.placeCursor(1);
      type(c, '\n');
      expect(log, ['split@1']);
      expect(c.block.text, 'ab', reason: 'the editor does the split itself');
    });
    test('Backspace at the very start asks to merge', () {
      final log = <String>[];
      final c = _controller(TextBlock('paragraph', {}, text: 'x'), log: log);
      c.placeCursor(0);
      backspace(c);
      expect(log, ['merge']);
      expect(c.block.text, 'x');
    });
    test('bold switched on with nothing selected applies to what is typed next', () {
      final c = _controller(TextBlock('paragraph', {}), mode: InputMode.english);
      type(c, 'a');
      c.toggleMark('bold');
      type(c, 'b');
      expect(c.block.marks.map((m) => m.has('bold')).toList(), [false, true]);
      expect(EditorDocument([c.block]).toJson()['content'], [
        {
          'type': 'paragraph',
          'content': [
            {'type': 'text', 'text': 'a'},
            {
              'type': 'text',
              'text': 'b',
              'marks': [
                {'type': 'bold'}
              ]
            },
          ]
        }
      ]);
    });
    test('bold on a selection, and off again', () {
      final c = _controller(TextBlock('paragraph', {}), mode: InputMode.english);
      type(c, 'abcd');
      c.selection = const TextSelection(baseOffset: 2, extentOffset: 4); // "bc" (sentinel at 0)
      c.toggleMark('bold');
      expect(c.block.marks.map((m) => m.has('bold')).toList(), [false, true, true, false]);
      c.toggleMark('bold');
      expect(c.block.marks.every((m) => !m.has('bold')), isTrue);
    });
    test('typing after bold text stays bold; marks and footnotes survive edits around them', () {
      final d = EditorDocument.fromJson(richDoc);
      final para = d.blocks[1] as TextBlock;
      final c = _controller(para, mode: InputMode.english);
      final footnoteAt = para.atoms.keys.single;
      c.placeCursor(0);
      type(c, 'X');
      expect(para.atoms.keys.single, footnoteAt + 1);
      final json = jsonEncode(d.toJson());
      expect(json, contains('"text":"Xഒന്ന് "'));
      expect(json, contains('"fontSize":"14pt"'));
      expect(json, contains('"type":"footnote"'));
    });
    test('split and merge keep marks and pieces', () {
      final d = EditorDocument.fromJson(richDoc);
      final para = d.blocks[1] as TextBlock;
      final original = jsonEncode(para.toJson());
      final after = para.splitAt(3);
      para.append(after);
      expect(jsonEncode(para.toJson()), original);
    });
  });

  test('drop cap takes a whole akshara, so conjuncts are never cut', () {
    String cap(String t) => t.substring(0, firstAksharaLength(t));
    expect(cap('എന്താടോ'), 'എ');
    expect(cap('സ്നേഹം'), 'സ്നേ');
    expect(cap('ക്ഷമ'), 'ക്ഷ');
    expect(cap('ശ്രീ'), 'ശ്രീ');
    expect(cap('അം'), 'അം');
    expect(cap('“ഞാൻ'), '“ഞാ');
    expect(cap('ൻ'), 'ൻ');
    expect(cap('Hello'), 'H');
    expect(cap(' x'), '');
    expect(cap(''), '');
  });
}
