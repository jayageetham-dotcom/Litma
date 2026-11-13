import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/providers.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../widgets/brand.dart';
import '../../widgets/avatar.dart';
import 'ai_settings.dart';
import '../goals/goals_screen.dart';
import '../../data/backup.dart';
import 'package:share_plus/share_plus.dart';
import '../../widgets/common.dart';
import '../../widgets/legal.dart';
import '../../data/analytics.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static Route<void> route() {
    Analytics.screen('/settings/');
    return MaterialPageRoute(builder: (_) => const SettingsScreen());
  }

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
                ProfileAvatar(profile: profile, fallbackName: name, size: 52),
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
          if (writer != null) ...[
            item(_Section(context.t('goals.title'))),
            item(_Card(children: [
              ListTile(
                leading: Icon(LucideIcons.target, color: c.tintTangerine),
                title: Text(context.t('goals.open')),
                subtitle: Text(context.t('goals.settingsIntro')),
                trailing: const Icon(LucideIcons.chevronRight, size: 18),
                onTap: () => Navigator.of(context).push(GoalsScreen.route()),
              ),
            ])),
            item(_Section(context.t('backup.title'))),
            item(const _BackupCard()),
          ],
          if (writer != null) ...[
            item(_Section(context.t('app.settings2.ai'))),
            item(const AiSettings()),
          ],
          item(_Section(context.t('settings.usage'))),
          item(_Card(children: [_UsageSwitch(prefs: services.prefs)])),
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
            // the help site (getlitma.in/help/) opens in the phone's browser
            ListTile(
              leading: const Icon(LucideIcons.lifeBuoy),
              title: Text(context.t('settings.help')),
              subtitle: Text(context.t('settings.helpHint')),
              trailing: const Icon(LucideIcons.externalLink, size: 16),
              onTap: () {
                Analytics.tap('settings.help');
                launchUrl(Uri.parse('${AppConfig.site}/help/'), mode: LaunchMode.externalApplication);
              },
            ),
            // Litma Community (getlitma.in/community/) opens in the phone's browser until the app has its own screens
            ListTile(
              leading: const Icon(LucideIcons.users),
              title: Text(context.t('community.eyebrow')),
              subtitle: Text(context.t('community.cardHint')),
              trailing: const Icon(LucideIcons.externalLink, size: 16),
              onTap: () {
                Analytics.tap('community.eyebrow');
                launchUrl(Uri.parse('${AppConfig.site}/community/'), mode: LaunchMode.externalApplication);
              },
            ),
            // the help guide that credits mlmorph, Olam, the fonts and the other open work Litma uses
            ListTile(
              leading: const Icon(LucideIcons.award),
              title: Text(context.t('legal.credits')),
              trailing: const Icon(LucideIcons.externalLink, size: 16),
              onTap: () {
                Analytics.tap('legal.credits');
                launchUrl(Uri.parse('${AppConfig.site}/help/?a=credits'), mode: LaunchMode.externalApplication);
              },
            ),
            ListTile(
              leading: const Icon(LucideIcons.globe),
              title: Text(context.t('app.settings.website')),
              subtitle: const Text('getlitma.in'),
              trailing: const Icon(LucideIcons.externalLink, size: 16),
              onTap: () => launchUrl(Uri.parse(AppConfig.site), mode: LaunchMode.externalApplication),
            ),
            ListTile(leading: const Icon(LucideIcons.shieldCheck), title: Text(context.t('legal.privacy')), trailing: const Icon(LucideIcons.externalLink, size: 16), onTap: () => openLegal('privacy')),
            ListTile(leading: const Icon(LucideIcons.fileText), title: Text(context.t('legal.terms')), trailing: const Icon(LucideIcons.externalLink, size: 16), onTap: () => openLegal('terms')),
            ListTile(leading: const Icon(LucideIcons.bookOpenText), title: Text(context.t('community.guidelines')), trailing: const Icon(LucideIcons.externalLink, size: 16), onTap: () => openLegal('community/guidelines')),
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

/// Settings → Usage statistics: on unless the writer switches it off (same key as the web).
class _UsageSwitch extends StatefulWidget {
  const _UsageSwitch({required this.prefs});
  final SharedPreferences prefs;

  @override
  State<_UsageSwitch> createState() => _UsageSwitchState();
}

class _UsageSwitchState extends State<_UsageSwitch> {
  late bool _on = Analytics.enabledIn(widget.prefs);

  @override
  Widget build(BuildContext context) => SwitchListTile(
        value: _on,
        title: Text(context.t('settings.usageOn')),
        subtitle: Padding(padding: const EdgeInsets.only(top: 4), child: Text(context.t('settings.usageHint'))),
        onChanged: (v) {
          setState(() => _on = v);
          Analytics.setEnabled(widget.prefs, v);
        },
      );
}

/// Settings → Backup: save everything as one file to Google Drive, Files or any app (the share
/// sheet), and keep a daily copy on the phone. Restoring is on the website or the desktop app.
class _BackupCard extends ConsumerStatefulWidget {
  const _BackupCard();

  @override
  ConsumerState<_BackupCard> createState() => _BackupCardState();
}

class _BackupCardState extends ConsumerState<_BackupCard> {
  var _busy = false;
  String? _msg;

  Future<void> _now() async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    final sv = ref.read(servicesProvider);
    try {
      var version = '';
      try {
        version = (await PackageInfo.fromPlatform()).version;
      } catch (_) {
        /* not available in tests */
      }
      final r = await Backup.make(sv.store, sv.prefs, appVersion: version);
      if (!mounted) return;
      setState(() => _msg = context.t('app.backup.ready', {'count': r.works}));
      await SharePlus.instance.share(ShareParams(files: [XFile(r.file.path, mimeType: 'application/zip')], subject: Backup.name()));
    } catch (_) {
      if (mounted) setState(() => _msg = context.t('backup.error.any'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final prefs = ref.read(servicesProvider).prefs;
    final last = Backup.last(prefs);
    return _Card(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
        child: Text(context.t('backup.intro'), style: Theme.of(context).textTheme.bodySmall),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
        child: Text(last == null ? context.t('backup.never') : context.t('backup.last', {'when': MaterialLocalizations.of(context).formatMediumDate(last)}), style: TextStyle(color: c.muted, fontSize: 12.5)),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: FilledButton.icon(
          icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.cloudUpload, size: 17),
          label: Text(_busy ? context.t('backup.working') : context.t('app.backup.share')),
          onPressed: _busy ? null : _now,
        ),
      ),
      if (_msg != null) Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 0), child: Text(_msg!, style: TextStyle(color: c.muted, fontSize: 12.5))),
      SwitchListTile(
        value: prefs.getBool(Backup.dailyKey) ?? false,
        title: Text(context.t('app.backup.daily')),
        subtitle: Text(context.t('app.backup.dailyHint')),
        onChanged: (v) async {
          await prefs.setBool(Backup.dailyKey, v);
          setState(() {});
        },
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        child: Text(context.t('app.backup.restoreWhere'), style: TextStyle(color: c.muted, fontSize: 12)),
      ),
    ]);
  }
}
