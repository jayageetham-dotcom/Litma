// Design previews: renders every screen with real fonts to PNG files, light and dark.
// Not a pass/fail test (fonts render a little differently on each computer). Run:
//   SCREENSHOTS=1 flutter test test/screenshots --update-goldens
// The pictures land in test/screenshots/out/.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:litma/app/app.dart';
import 'package:litma/app/providers.dart';
import 'package:litma/core/config.dart';
import 'package:litma/data/auth.dart';
import 'package:litma/data/fake.dart';
import 'package:litma/data/forms.dart';
import 'package:litma/data/local_db.dart';
import 'package:litma/data/offline.dart';
import 'package:litma/data/store.dart';
import 'package:litma/editor/document.dart';
import 'package:litma/editor/editor_screen.dart';
import 'package:litma/features/auth/auth_screen.dart';
import 'package:litma/features/auth/welcome_screen.dart';
import 'package:litma/features/desk/desk_screen.dart';
import 'package:litma/features/desk/type_picker.dart';
import 'package:litma/features/reader/reader_screen.dart';
import 'package:litma/features/settings/settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'sample_works.dart';

final shots = Platform.environment['SCREENSHOTS'] == '1';

Future<void> loadFonts() async {
  final pubspec = File('pubspec.yaml').readAsStringSync();
  final fam = RegExp(r'- family: (\w+)\n\s+fonts:\n((?:\s+- asset: .+\n(?:\s+weight: \d+\n)?)+)');
  for (final m in fam.allMatches(pubspec)) {
    final loader = FontLoader(m[1]!);
    for (final a in RegExp(r'asset: (.+)').allMatches(m[2]!)) {
      loader.addFont(Future.value(ByteData.sublistView(File(a[1]!.trim()).readAsBytesSync())));
    }
    await loader.load();
  }
  final home = Platform.environment['HOME'];
  final lucide = Directory('$home/.pub-cache/hosted/pub.dev').listSync().whereType<Directory>().firstWhere((d) => d.path.contains('lucide_icons_flutter'));
  for (final name in ['packages/lucide_icons_flutter/Lucide', 'Lucide', 'packages/lucide_icons_flutter/Lucide400', 'Lucide400']) {
    final file = name.endsWith('400') ? '${lucide.path}/assets/build_font/LucideVariable-w400.ttf' : '${lucide.path}/assets/lucide.ttf';
    await (FontLoader(name)..addFont(Future.value(ByteData.sublistView(File(file).readAsBytesSync())))).load();
  }
  final flutterRoot = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter-sdk/flutter';
  final icons = File('$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (icons.existsSync()) await (FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(icons.readAsBytesSync())))).load();
}

Future<Services> services({bool signedIn = true, bool withWorks = true, bool offline = false}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final messages = <String, Map<String, dynamic>>{};
  for (final code in ['en', 'ml']) {
    messages[code] = (await _json('assets/i18n/$code.json'));
  }
  final backend = FakeBackend(tables: withWorks ? sampleTables() : {'profiles': [sampleProfile]});
  backend.online = !offline;
  final auth = FakeAuth(signedIn ? const Writer(id: 'writer-1', email: 'aamina@example.com') : null);
  final o = OfflineLayer(db: MemoryDb(), backend: backend, uid: () => auth.writer?.id);
  return Services(auth: auth, offline: o, store: Store(o), prefs: prefs, messages: messages, transliterator: _NoNetTransliterator());
}

class _NoNetTransliterator extends Transliterator {
  @override
  Future<List<String>> candidates(String word, {int num = 6}) async => [...offline(word), '${offline(word).first}ം'];
}

Future<Map<String, dynamic>> _json(String path) async => (jsonDecode(File(path).readAsStringSync()) as Map).cast<String, dynamic>();

Future<void> shoot(WidgetTester tester, String name, Widget app, {Size size = const Size(390, 844), Brightness brightness = Brightness.light, Future<void> Function(WidgetTester)? then}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.platformBrightnessTestValue = brightness;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  await tester.pumpWidget(app);
  // let entrance animations, loads and fonts settle (no pumpAndSettle: loaders repeat)
  for (var i = 0; i < 30; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  if (then != null) await then(tester);
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await expectLater(find.byType(MaterialApp).first, matchesGoldenFile('out/$name.png'));
}

Widget app(Services s, {Widget? home}) => ProviderScope(overrides: [servicesProvider.overrideWithValue(s)], child: LitmaApp(home: home));

Future<void> settle(WidgetTester t, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(() async {
    if (shots) await loadFonts();
  });

  group('screens', skip: !shots, () {
    testWidgets('welcome', (t) async => shoot(t, 'welcome', app(await t.runAsync(() => services(signedIn: false)) as Services, home: const WelcomeScreen())));
    testWidgets('sign up', (t) async => shoot(t, 'auth-signup', app(await t.runAsync(() => services(signedIn: false)) as Services, home: const AuthScreen(signUp: true))));
    testWidgets('sign in', (t) async => shoot(t, 'auth-signin', app(await t.runAsync(() => services(signedIn: false)) as Services, home: const AuthScreen(signUp: false))));

    for (final b in Brightness.values) {
      testWidgets('desk ${b.name}', (t) async {
        final s = await t.runAsync(() => services()) as Services;
        await shoot(t, 'desk-${b.name}', app(s, home: const DeskScreen()), brightness: b, then: (t) async {
          await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
          await settle(t);
        });
      });
    }
    testWidgets('desk empty', (t) async {
      final s = await t.runAsync(() => services(withWorks: false)) as Services;
      await shoot(t, 'desk-empty', app(s, home: const DeskScreen()), then: (t) async {
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await settle(t);
      });
    });
    testWidgets('desk offline', (t) async {
      final s = await t.runAsync(() async {
        final s = await services();
        await s.store.listDocs(); // keep the copy on the phone
        (s.offline.backend as FakeBackend).online = false;
        await s.store.updateDoc('w-novel', {'title': 'പുഴ പറഞ്ഞ കഥ'});
        return s;
      }) as Services;
      await shoot(t, 'desk-offline', app(s, home: const DeskScreen()), then: (t) async {
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await settle(t);
      });
    });
    testWidgets('type picker', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      await shoot(t, 'type-picker', app(s, home: const _PickerHost()), then: (t) async {
        await t.tap(find.text('open'));
        await settle(t, 25);
      });
    });

    for (final (id, name) in [('w-novel', 'novel'), ('w-screenplay', 'screenplay'), ('w-poem', 'poem'), ('w-drama', 'drama')]) {
      for (final b in name == 'novel' ? Brightness.values : [Brightness.light]) {
        testWidgets('editor $name ${b.name}', (t) async {
          final s = await t.runAsync(() => services()) as Services;
          await shoot(t, 'editor-$name-${b.name}', app(s, home: EditorScreen(docId: id)), brightness: b, then: (t) async {
            await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
            await settle(t);
          });
        });
      }
    }
    testWidgets('editor typing (keyboard bar + suggestions)', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      await shoot(t, 'editor-typing', app(s, home: const EditorScreen(docId: 'w-story')), then: (t) async {
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await settle(t);
        final last = find.byType(TextField).last;
        await t.tap(last);
        t.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
        await settle(t, 5);
        await t.enterText(last, '${(t.widget<TextField>(last).controller!.text)} nammude');
        await settle(t, 10);
      });
    });
    testWidgets('new novel (prompts)', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      final doc = await t.runAsync(() => s.store.createDoc(DocKind.novel));
      await shoot(t, 'editor-new-novel', app(s, home: EditorScreen(docId: doc!.id, initial: doc)));
    });
    testWidgets('reader', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      final d = await t.runAsync(() => s.store.getDoc('w-novel'));
      await shoot(t, 'reader', app(s, home: ReaderScreen(title: d!.title, kind: d.kind, settings: d.settings, document: EditorDocument.fromJson(d.content))));
    });
    for (final b in Brightness.values) {
      testWidgets('settings ${b.name}', (t) async {
        final s = await t.runAsync(() => services()) as Services;
        await shoot(t, 'settings-${b.name}', app(s, home: const SettingsScreen()), brightness: b, then: (t) async {
          await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
          await settle(t);
        });
      });
    }
    testWidgets('desk tablet', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      await shoot(t, 'desk-tablet', app(s, home: const DeskScreen()), size: const Size(1024, 768), then: (t) async {
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await settle(t);
      });
    });
    testWidgets('editor tablet', (t) async {
      final s = await t.runAsync(() => services()) as Services;
      await shoot(t, 'editor-tablet', app(s, home: const EditorScreen(docId: 'w-novel')), size: const Size(1024, 768), then: (t) async {
        await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
        await settle(t);
      });
    });
  });
}

class _PickerHost extends ConsumerWidget {
  const _PickerHost();
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Center(child: TextButton(onPressed: () => showTypePicker(context, ref), child: const Text('open'))));
}
