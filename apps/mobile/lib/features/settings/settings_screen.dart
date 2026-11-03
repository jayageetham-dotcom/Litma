import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../widgets/brand.dart';
import '../../widgets/common.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static Route<void> route() => MaterialPageRoute(builder: (_) => const SettingsScreen());

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final settings = ref.watch(settingsProvider);
    final writer = ref.watch(writerProvider).value;
    final profile = ref.watch(profileProvider).value;
    final sync = ref.watch(syncStateProvider).value;
    final services = ref.read(servicesProvider);
    final name = profile?.name ?? writer?.email ?? '';
    var i = 0;
    Widget item(Widget w) => FadeSlideIn(index: i++, child: w);

    return Scaffold(
      appBar: AppBar(title: Text(context.t('app.settings.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          item(_Card(children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Hero(tag: 'avatar', child: LetterAvatar(name: name, size: 52)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: LitmaFonts.display)),
                    if (writer?.email != null) Text(writer!.email!, style: Theme.of(context).textTheme.bodySmall),
                  ]),
                ),
              ]),
            ),
          ])),
          item(_Section(context.t('app.settings.sync'))),
          item(_Card(children: [
            ListTile(
              leading: Icon(sync?.offline == true ? LucideIcons.cloudOff : LucideIcons.cloudCheck, color: sync?.offline == true ? c.highlight : c.tintSky),
              title: Text(sync == null || (sync.pending == 0 && !sync.offline)
                  ? context.t('app.settings.syncAll')
                  : sync.offline
                      ? context.t('offline.offline')
                      : context.t('offline.pending', {'count': sync.pending})),
              subtitle: sync != null && sync.pending > 0 ? Text(context.t('offline.pending', {'count': sync.pending})) : null,
              trailing: TextButton(onPressed: services.offline.sync, child: Text(context.t('app.settings.syncNow'))),
            ),
          ])),
          item(_Section(context.t('app.settings.appearance'))),
          item(_Card(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Text(context.t('app.settings.theme'), style: Theme.of(context).textTheme.labelLarge),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
              child: SegmentedButton<ThemeMode>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: ThemeMode.system, label: Text(context.t('app.settings.themeSystem'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ButtonSegment(value: ThemeMode.light, label: Text(context.t('app.settings.themeLight'))),
                  ButtonSegment(value: ThemeMode.dark, label: Text(context.t('app.settings.themeDark'))),
                ],
                selected: {settings.themeMode},
                onSelectionChanged: (s) {
                  Haptics.tap();
                  ref.read(settingsProvider.notifier).setTheme(s.first);
                },
              ),
            ),
            const Divider(indent: 16, endIndent: 16),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 2),
              child: Text(context.t('settings.uiLanguage'), style: Theme.of(context).textTheme.labelLarge),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Text(context.t('settings.languageHint'), style: Theme.of(context).textTheme.bodySmall),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 14),
              child: SegmentedButton<String>(
                showSelectedIcon: false,
                segments: [for (final e in Strings.locales.entries) ButtonSegment(value: e.key, label: Text(e.value))],
                selected: {settings.locale},
                onSelectionChanged: (s) {
                  Haptics.tap();
                  ref.read(settingsProvider.notifier).setLocale(s.first);
                },
              ),
            ),
          ])),
          if (writer != null) ...[
            item(_Section(context.t('app.settings.typingDefault'))),
            item(_Card(children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: SegmentedButton<String>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(value: 'manglish', label: Text(context.t('app.editor.manglish'))),
                    ButtonSegment(value: 'malayalam', label: Text(context.t('app.editor.malayalam'))),
                    ButtonSegment(value: 'english', label: Text(context.t('app.editor.english'))),
                  ],
                  selected: {(profile?.preferences['inputMode'] as String?) ?? 'manglish'},
                  onSelectionChanged: (s) async {
                    Haptics.tap();
                    await services.store.updateProfile(writer.id, {'preferences': {...?profile?.preferences, 'inputMode': s.first}});
                    ref.invalidate(profileProvider);
                  },
                ),
              ),
            ])),
          ],
          item(_Section(context.t('app.settings.about'))),
          item(_Card(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(children: [
                const Wordmark(size: 22),
                const Spacer(),
                // one version for web, desktop and phone (pubspec.yaml, set by the Release workflow)
                FutureBuilder<PackageInfo>(
                  future: PackageInfo.fromPlatform(),
                  builder: (context, info) => Text(info.hasData ? context.t('app.settings.version', {'v': info.data!.version}) : '', style: Theme.of(context).textTheme.bodySmall),
                ),
              ]),
            ),
            ListTile(leading: const Icon(LucideIcons.globe), title: Text(context.t('app.settings.website')), subtitle: const Text('getlitma.in')),
          ])),
          const SizedBox(height: 20),
          if (writer != null)
            item(OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: c.danger, side: BorderSide(color: c.danger.withValues(alpha: 0.5))),
              onPressed: () async {
                final ok = await confirm(context, title: context.t('app.settings.signOutTitle'), body: context.t('app.settings.signOutBody'), action: context.t('nav.signOut'), danger: true);
                if (!ok) return;
                await services.auth.signOut();
                if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst);
              },
              icon: const Icon(LucideIcons.logOut, size: 18),
              label: Text(context.t('nav.signOut')),
            )),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(6, 22, 6, 8),
        child: Row(children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: context.c.accent)),
          const SizedBox(width: 8),
          Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: context.c.muted)),
        ]),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: context.c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: context.c.line)),
        clipBehavior: Clip.antiAlias,
        child: Material(type: MaterialType.transparency, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)),
      );
}
