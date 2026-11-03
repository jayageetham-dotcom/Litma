import 'package:flutter_test/flutter_test.dart';
import 'package:litma/data/backend.dart';
import 'package:litma/data/fake.dart';
import 'package:litma/data/local_db.dart';
import 'package:litma/data/models.dart';
import 'package:litma/data/offline.dart';
import 'package:litma/data/store.dart';

Json _text(String s) => {
      'type': 'doc',
      'content': [
        {
          'type': 'paragraph',
          'content': [
            {'type': 'text', 'text': s}
          ]
        }
      ]
    };

void main() {
  late FakeBackend server;
  late OfflineLayer offline;
  late Store store;

  setUp(() {
    server = FakeBackend();
    offline = OfflineLayer(db: MemoryDb(), backend: server, uid: () => 'writer-1');
    store = Store(offline);
  });
  tearDown(() => offline.dispose());

  test('online: create and save reach the server', () async {
    final doc = await store.createDoc(DocKind.story, profile: Profile(id: 'writer-1', penName: 'Tester'));
    expect(server.tables['documents']!.single['id'], doc.id);
    // the author line starts with the writer's pen name
    expect(plainTextOf(doc.content), contains('Tester'));
    final queued = await store.updateDoc(doc.id, {'content': _text('111222')});
    expect(queued, isFalse);
    expect(plainTextOf((server.tables['documents']!.single['content'] as Map).cast()), '111222');
  });

  test('offline: changes wait on the phone, the work reopens, and everything syncs later', () async {
    final doc = await store.createDoc(DocKind.novel);
    await store.updateDoc(doc.id, {'content': _text('online')});

    server.online = false;
    expect(await store.updateDoc(doc.id, {'content': _text('online offline')}), isTrue);
    expect(await offline.pendingCount(), 1);
    // merged into the same waiting change
    expect(await store.updateDoc(doc.id, {'title': 'പുതിയ പേര്'}), isTrue);
    expect(await offline.pendingCount(), 1);

    final reopened = await store.getDoc(doc.id);
    expect(plainTextOf(reopened!.content), 'online offline');
    final listed = await store.listDocs();
    expect(listed.map((d) => d.title), contains('പുതിയ പേര്'));

    // a new work made offline, then typed in
    final fresh = await store.createDoc(DocKind.poem);
    await store.updateDoc(fresh.id, {'content': _text('555666')});
    expect(await offline.pendingCount(), 2, reason: 'the edit merges into the waiting insert');

    server.online = true;
    expect(await offline.sync(), isTrue);
    expect(await offline.pendingCount(), 0);
    final rows = {for (final r in server.tables['documents']!) r['id']: r};
    expect(plainTextOf((rows[doc.id]!['content'] as Map).cast()), 'online offline');
    expect(rows[doc.id]!['title'], 'പുതിയ പേര്');
    expect(plainTextOf((rows[fresh.id]!['content'] as Map).cast()), '555666');
  });

  test('a work deleted offline before it ever reached the server is never sent', () async {
    server.online = false;
    final doc = await store.createDoc(DocKind.blank);
    await store.updateDoc(doc.id, {'content': _text('x')});
    await store.deleteDoc(doc.id);
    expect(await offline.pendingCount(), 0);
    server.online = true;
    await offline.sync();
    expect(server.tables['documents'] ?? [], isEmpty);
  });

  test('offline text over a work changed elsewhere keeps the other copy as a version', () async {
    final doc = await store.createDoc(DocKind.story);
    await store.updateDoc(doc.id, {'content': _text('base')});

    server.online = false;
    await store.updateDoc(doc.id, {'content': _text('phone text')});

    // meanwhile someone edits the same work on the web
    server.online = true;
    await server.update('documents', doc.id, {'content': _text('web text')});

    expect(await offline.sync(), isTrue);
    final versions = server.tables['document_versions'] ?? [];
    expect(versions, hasLength(1));
    expect(versions.single['label'], conflictLabel);
    expect(plainTextOf((versions.single['content'] as Map).cast()), 'web text');
    expect(plainTextOf((server.tables['documents']!.single['content'] as Map).cast()), 'phone text');
  });

  test('no conflict version when only this phone changed the work', () async {
    final doc = await store.createDoc(DocKind.story);
    await store.updateDoc(doc.id, {'content': _text('base')});
    server.online = false;
    await store.updateDoc(doc.id, {'content': _text('phone text')});
    server.online = true;
    await offline.sync();
    expect(server.tables['document_versions'] ?? [], isEmpty);
  });

  test('server unreachable: later reads use the device copy at once', () async {
    await store.createDoc(DocKind.story);
    await store.listDocs();
    server.online = false;
    await expectLater(store.listDocs(), completion(hasLength(1)));
    expect(offline.offline, isTrue);
    int docReads() => server.log.where((l) => l == 'select documents').length;
    final before = docReads();
    await store.listDocs();
    expect(docReads(), before, reason: 'reads use the device copy while the server is known to be down (only a background probe is sent)');
    server.online = true;
    await offline.sync();
    expect(offline.offline, isFalse);
  });

  test('words written offline are added up into one change', () async {
    server.online = false;
    await store.addWordsToday(10);
    await store.addWordsToday(5);
    expect(await offline.pendingCount(), 1);
    server.online = true;
    await offline.sync();
    expect(server.tables['writing_days']!.single['words'], 15);
  });

  test('a duplicate-key answer to an insert means it already arrived', () async {
    server.online = false;
    final doc = await store.createDoc(DocKind.story);
    // the insert reached the server but its answer was lost
    server.online = true;
    await server.insert('documents', {'id': doc.id, 'title': doc.title, 'kind': 'story', 'content': doc.content, 'settings': doc.settings});
    expect(await offline.sync(), isTrue);
    expect(server.tables['documents'], hasLength(1));
  });

  test('a refused change is kept on the phone and the queue moves on', () async {
    final failing = _RefusingBackend();
    final o = OfflineLayer(db: MemoryDb(), backend: failing, uid: () => 'w');
    await o.enqueue({'kind': 'update', 'table': 'documents', 'id': 'a', 'patch': {'title': 'x'}});
    for (var i = 0; i < 3; i++) {
      await o.sync();
    }
    expect(await o.pendingCount(), 0);
    expect(await o.all('failed'), hasLength(1));
    o.dispose();
  });
}

class _RefusingBackend extends FakeBackend {
  @override
  Future<Json?> update(String table, String id, Json patch, {String columns = 'updated_at'}) async => throw ServerException('denied', code: '42501', status: 403);
}
