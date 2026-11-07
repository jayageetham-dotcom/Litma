import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:litma/app/update_check.dart';
import 'package:litma/core/config.dart';
import 'package:litma/data/dictionary.dart';
import 'package:litma/data/fake.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/local_db.dart';
import 'package:litma/data/models.dart';
import 'package:litma/data/offline.dart';
import 'package:litma/data/story.dart';
import 'package:litma/data/store.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/export.dart';
import 'package:litma/editor/session.dart';

/// Shards in the same shape as the website's /dict data (scripts/build-dictionary.mjs).
final shards = <String, Object>{
  'index': {'version': 't', 'format': 2, 'enSplit': <String>[], 'mlSplit': <String>[], 'counts': {}, 'sources': []},
  'en/f': {
    'forest': {
      'h': 'forest',
      'd': {'n': ['കാട്', 'വനം']},
      's': [
        {
          'p': 'n',
          'en': [['woods', 'woodland']],
          'ml': [['വനം', 'കാനനം', 'അടവി']]
        }
      ]
    }
  },
  'ml/d15': {
    'കാട്': {
      'd': {'നാ.': ['വനം, അടവി']},
      'e': ['forest', 'jungle'],
      'r': [['forest', 0, 0]]
    }
  },
};

Dictionary dictionary() {
  final client = MockClient((req) async {
    final path = req.url.path.replaceFirst('/dict/', '').replaceFirst('.json', '');
    final s = shards[path];
    return s == null ? http.Response('not found', 404) : http.Response.bytes(utf8.encode(jsonEncode(s)), 200);
  });
  return Dictionary(OfflineLayer(db: MemoryDb(), backend: FakeBackend(), uid: () => 'w'), client: client);
}

void main() {
  group('dictionary (port of shared/dict.ts)', () {
    test('English word: Malayalam meanings, synonyms, translations', () async {
      final r = await dictionary().lookup('forests');
      expect(r.head, 'forest', reason: 'plural is stemmed');
      expect(r.translations, containsAll(['കാട്', 'വനം', 'കാനനം']));
      expect(r.synonyms, containsAll(['woods', 'woodland']));
    });
    test('Malayalam word with an ending: the entry, ranked synonyms', () async {
      final r = await dictionary().lookup('കാടിന്');
      expect(r.head, 'കാട്', reason: 'the ending ിന് comes off and the stem is tried with ്, as on the web');
      final r2 = await dictionary().lookup('കാട്');
      expect(r2.head, 'കാട്');
      expect(r2.synonyms.first, 'വനം', reason: 'in both the definition and the strongest thesaurus set');
      expect(r2.translations, ['forest', 'jungle']);
    });
    test('suggestions by prefix', () async {
      expect(await dictionary().suggest('fo'), ['forest']);
    });
    test('unknown word', () async {
      expect((await dictionary().lookup('qwxz')).found, isFalse);
    });
  });

  test('Story World: a card with nothing written in it is blank (auto fields do not count)', () {
    expect(isBlankItem({'name': '', 'summary': ' ', 'data': {'group': 'ആരംഭം', 'status': 'Idea'}}), isTrue);
    expect(isBlankItem({'name': 'ഉമ്മ', 'data': {}}), isFalse);
    expect(isBlankItem({'name': '', 'data': {'age': '60'}}), isFalse);
    expect(storyTabsFor(DocKind.drama).map((t) => t.id), contains('sets'));
    expect(defaultBeatGroups(DocKind.novel), ['ആരംഭം', 'മധ്യം', 'അന്ത്യം']);
  });

  test('export: HTML keeps titles, chapters, marks and dialogue', () {
    final doc = EditorDocument.fromJson({
      'type': 'doc',
      'content': [
        {'type': 'styledBlock', 'attrs': {'variant': 'title'}, 'content': [{'type': 'text', 'text': 'മഴ'}]},
        {'type': 'styledBlock', 'attrs': {'variant': 'chapter'}, 'content': [{'type': 'text', 'text': 'ഒന്ന്'}]},
        {
          'type': 'paragraph',
          'content': [
            {'type': 'text', 'text': 'കനത്ത', 'marks': [{'type': 'bold'}]},
            {'type': 'text', 'text': ' <മഴ>'}
          ]
        },
        {'type': 'dialogue', 'content': [{'type': 'dialogueCue', 'content': [{'type': 'text', 'text': 'ഉമ്മ'}]}, {'type': 'dialogueSpeech', 'content': [{'type': 'text', 'text': 'വാ'}]}]},
      ]
    });
    final html = docToHtml(doc, title: 'മഴ', kind: DocKind.novel, settings: settingsFor(DocKind.novel));
    expect(html, contains('<p class="sb sb-title">മഴ</p>'));
    expect(html, contains('sb-chapter'));
    expect(html, contains('<b>കനത്ത</b> &lt;മഴ&gt;'), reason: 'text is escaped');
    expect(html, contains('ഉമ്മ:'));
    expect(html, contains("font-family: 'Noto Serif Malayalam'"));
  });

  test('update prompt compares versions', () {
    expect(compareVersions('0.8.0', '0.7.11'), 1);
    expect(compareVersions('0.7.9+3', '0.7.9'), 0);
    expect(compareVersions('0.7.9', '1.0.0'), -1);
  });

  testWidgets('AI and inbox text goes in at the cursor; several paragraphs become lines', (t) async {
    final o = OfflineLayer(db: MemoryDb(), backend: FakeBackend(), uid: () => 'w');
    final store = Store(o);
    final doc = await t.runAsync(() => store.createDoc(DocKind.story));
    final s = EditorSession(doc: doc!, store: store);
    await t.pumpWidget(const MaterialApp(home: SizedBox()));
    final body = s.lines.last;
    s.focusLine(body, at: 0);
    s.insertText('ഒന്നാം വരി\n\nരണ്ടാം വരി');
    expect(s.document.toJson()['content'].last['content'].first['text'], 'രണ്ടാം വരി');
    expect(s.replaceInDocument('ഒന്നാം', 'ആദ്യ'), isTrue);
    expect(s.document.plainText, contains('ആദ്യ വരി'));
    s.saver.dispose();
    o.dispose();
    await t.pump(const Duration(seconds: 2));
  });

  test('books: a new book gets the standard pages and the classic cover; chapters are counted', () async {
    final o = OfflineLayer(db: MemoryDb(), backend: FakeBackend(), uid: () => 'w');
    final store = Store(o);
    final b = await store.createBook(profile: Profile(id: 'w', penName: 'ആമിന'));
    expect(b.structure.map((i) => i['type']), ['cover', 'half-title', 'title', 'copyright', 'toc', 'back-cover']);
    expect(b.author, 'ആമിന');
    expect(b.cover['preset'], 'classic');
    await store.updateBook(b.id, {'structure': [...b.structure, {'id': 'x', 'type': 'document', 'documentId': 'd1'}]});
    expect((await store.getBook(b.id))!.chapters, 1);
    o.dispose();
  });

  test('Malayalam suggestions: all of them, best first, no repeats', () async {
    final t = Transliterator(client: MockClient((req) async => http.Response(jsonEncode({'candidates': ['എന്ന്', 'എന്നു', 'എന്ന്', 'ഇന്ന്', 'ഇന്നു', 'എന്ന'], 'source': 'google'}), 200, headers: {'content-type': 'application/json; charset=utf-8'})));
    final list = await t.candidates('ennu');
    expect(list.take(5), ['എന്ന്', 'എന്നു', 'ഇന്ന്', 'ഇന്നു', 'എന്ന']);
    expect(list.toSet().length, list.length);
    expect(t.candidates('ennu', num: 3), completion(hasLength(3)));
    expect(Transliterator.maxCandidates, 18);
  });
}
