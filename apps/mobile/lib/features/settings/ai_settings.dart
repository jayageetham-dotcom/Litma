import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/ai.dart';
import '../../widgets/common.dart';

/// Settings → AI keys (the writer's own key per provider; stored encrypted by litma-ai) and
/// Connect an AI assistant (MCP connections; only hashes are stored, the address shows once).
class AiSettings extends ConsumerStatefulWidget {
  const AiSettings({super.key});
  @override
  ConsumerState<AiSettings> createState() => _AiSettingsState();
}

class _AiSettingsState extends ConsumerState<AiSettings> {
  List<({String provider, String last4})>? _keys;
  List<Map<String, dynamic>>? _tokens;
  String? _fresh;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final s = ref.read(servicesProvider);
    final keys = await s.ai.keys().catchError((_) => <({String provider, String last4})>[]);
    final tokens = await s.store.listTokens();
    if (mounted) {
      setState(() {
        _keys = keys;
        _tokens = tokens;
      });
    }
  }

  Future<void> _addKey(String provider) async {
    final ctrl = TextEditingController();
    final key = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${aiProviders[provider]} · ${context.t('app.settings2.keyLabel')}'),
        content: TextField(controller: ctrl, autofocus: true, obscureText: true, decoration: InputDecoration(labelText: context.t('app.settings2.keyLabel'))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), style: TextButton.styleFrom(foregroundColor: context.c.ink), child: Text(context.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text.trim()), child: Text(context.t('common.save'))),
        ],
      ),
    );
    if (key == null || key.isEmpty) return;
    try {
      await ref.read(servicesProvider).ai.setKey(provider, key);
      Haptics.confirm();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.t('app.ai.badKey'))));
    }
    await _load();
  }

  Future<void> _newToken() async {
    final token = await ref.read(servicesProvider).store.createToken('Phone · ${DateTime.now().toIso8601String().substring(0, 10)}');
    final url = '${AppConfig.functionsUrl}/litma-mcp?key=$token';
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    setState(() => _fresh = url);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.t('app.settings2.tokenCopied'))));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final keyed = {for (final k in _keys ?? const <({String provider, String last4})>[]) k.provider: k.last4};
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(right: 8), child: Text(context.t('app.settings2.aiHint'), style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 6),
          if (_keys == null) const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator()),
          for (final p in aiProviders.entries)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(LucideIcons.keyRound, color: keyed.containsKey(p.key) ? c.tintLime : c.muted),
              title: Text(p.value),
              subtitle: Text(keyed.containsKey(p.key) ? '•••• ${keyed[p.key]}' : '—'),
              trailing: keyed.containsKey(p.key)
                  ? TextButton(
                      onPressed: () async {
                        await ref.read(servicesProvider).ai.deleteKey(p.key).catchError((_) {});
                        await _load();
                      },
                      style: TextButton.styleFrom(foregroundColor: c.danger),
                      child: Text(context.t('app.settings2.removeKey')),
                    )
                  : TextButton(onPressed: () => _addKey(p.key), child: Text(context.t('app.settings2.addKey'))),
            ),
        ]),
      ),
      const SizedBox(height: 12),
      Container(
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(context.t('app.settings2.mcp'), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          Padding(padding: const EdgeInsets.only(right: 8), child: Text(context.t('app.settings2.mcpHint'), style: Theme.of(context).textTheme.bodySmall)),
          AnimatedSize(
            duration: Motion.of(context, Motion.medium),
            child: _fresh == null
                ? const SizedBox(width: double.infinity)
                : Container(
                    margin: const EdgeInsets.fromLTRB(0, 10, 8, 0),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: c.highlightSoft, borderRadius: BorderRadius.circular(10)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(context.t('app.settings2.tokenOnce'), style: TextStyle(color: c.highlight, fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 4),
                      SelectableText(_fresh!, style: const TextStyle(fontSize: 12.5, fontFamily: 'monospace')),
                    ]),
                  ),
          ),
          for (final t in _tokens ?? const <Map<String, dynamic>>[])
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(LucideIcons.plug, color: t['last_used_at'] != null ? c.tintSky : c.muted),
              title: Text('${t['name']}'),
              subtitle: Text(t['last_used_at'] != null ? context.t('app.settings2.tokenUsed', {'when': relativeTime(context, DateTime.tryParse('${t['last_used_at']}') ?? DateTime.now())}) : context.t('app.settings2.tokenNever')),
              trailing: IconButton(
                icon: Icon(LucideIcons.trash2, size: 18, color: c.danger),
                onPressed: () async {
                  await ref.read(servicesProvider).store.deleteToken('${t['id']}').catchError((_) {});
                  await _load();
                },
              ),
            ),
          Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: _newToken, icon: const Icon(LucideIcons.plus, size: 16), label: Text(context.t('app.settings2.newToken')))),
        ]),
      ),
    ]);
  }
}
