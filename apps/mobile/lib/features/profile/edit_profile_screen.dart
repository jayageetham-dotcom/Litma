import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/auth.dart';
import '../../data/models.dart';
import '../../widgets/avatar.dart';

/// Edit the profile: picture, names, details, daily goal, default typing, and the password.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key, required this.profile});
  final Profile profile;

  static Route<void> route(Profile p) => MaterialPageRoute(fullscreenDialog: true, builder: (_) => EditProfileScreen(profile: p));

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late final _name = TextEditingController(text: widget.profile.displayName ?? '');
  late final _pen = TextEditingController(text: widget.profile.penName ?? '');
  late final _username = TextEditingController(text: widget.profile.username ?? '');
  late final _location = TextEditingController(text: widget.profile.location ?? '');
  late final _bio = TextEditingController(text: widget.profile.bio ?? '');
  late final _website = TextEditingController(text: widget.profile.website ?? '');
  late final _goal = TextEditingController(text: '${widget.profile.dailyGoal}');
  final _password = TextEditingController();
  late String _avatar = (widget.profile.preferences['avatar'] as String?) ?? 'letter';
  late String _tint = avatarTints.contains(widget.profile.preferences['avatarTint']) ? widget.profile.preferences['avatarTint'] as String : tintFor(widget.profile.avatarName);
  late String _mode = (widget.profile.preferences['inputMode'] as String?) ?? 'manglish';
  bool _saving = false;
  String? _error;
  String? _passwordNote;

  String get _avatarName => _pen.text.trim().isNotEmpty ? _pen.text.trim() : _name.text.trim();

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final username = _username.text.trim().toLowerCase();
      if (username.isNotEmpty && !RegExp(r'^[a-z0-9_]{3,30}$').hasMatch(username)) throw context.t('app.profile.usernameRule');
      String? v(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
      final s = ref.read(servicesProvider);
      await s.store.updateProfile(widget.profile.id, {
        'display_name': v(_name),
        'pen_name': v(_pen),
        'username': username.isEmpty ? null : username,
        'bio': v(_bio),
        'location': v(_location),
        'website': v(_website),
        'daily_goal': int.tryParse(_goal.text.trim()) ?? 0,
        'preferences': {...widget.profile.preferences, 'avatar': _avatar, 'avatarTint': _tint, 'inputMode': _mode},
      });
      ref.invalidate(profileProvider);
      Haptics.confirm();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      final m = '$e';
      setState(() => _error = RegExp('duplicate key|unique', caseSensitive: false).hasMatch(m) ? context.t('app.profile.usernameTaken') : m);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _changePassword() async {
    try {
      await ref.read(servicesProvider).auth.updatePassword(_password.text);
      _password.clear();
      setState(() => _passwordNote = context.t('app.profile.passwordChanged'));
    } catch (e) {
      setState(() => _passwordNote = authMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final email = ref.watch(writerProvider).value?.email ?? widget.profile.email;
    Widget field(TextEditingController ctrl, String label, {String? hint, TextInputType? type, int lines = 1, int? max, List<String>? autofill}) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: ctrl,
            keyboardType: type,
            maxLines: lines,
            minLines: lines > 1 ? 3 : 1,
            maxLength: max,
            autofillHints: autofill,
            onChanged: (_) => setState(() {}),
            style: lines > 1 ? const TextStyle(fontFamily: LitmaFonts.sans, fontSize: 16, height: 1.5) : null,
            decoration: InputDecoration(labelText: label, helperText: hint, helperMaxLines: 2),
          ),
        );

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(LucideIcons.x), tooltip: context.t('common.cancel'), onPressed: () => Navigator.pop(context)),
        title: Text(context.t('app.profile.edit')),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(minimumSize: const Size(80, 40)),
              child: SwapFade(
                alignment: Alignment.center,
                child: _saving
                    ? SizedBox.square(key: const ValueKey('s'), dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.primaryInk))
                    : Text(context.t('common.save'), key: const ValueKey('t')),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 48),
        children: [
          Center(child: Hero(tag: 'avatar', child: AnimatedSwitcher(duration: Motion.of(context, Motion.medium), child: AvatarArt(key: ValueKey('$_avatar$_tint'), id: _avatar, name: _avatarName, tint: _tint, size: 96)))),
          const SizedBox(height: 16),
          Row(children: [
            Text(context.t('avatar.title'), style: Theme.of(context).textTheme.titleSmall),
            const Spacer(),
            TextButton.icon(
              onPressed: () {
                final r = Random();
                final opts = ['letter', ...avatarImages]..remove(_avatar);
                setState(() {
                  _avatar = opts[r.nextInt(opts.length)];
                  _tint = avatarTints[r.nextInt(avatarTints.length)];
                });
                Haptics.tap();
              },
              icon: const Icon(LucideIcons.shuffle, size: 16),
              label: Text(context.t('avatar.shuffle')),
            ),
          ]),
          const SizedBox(height: 6),
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final id in ['letter', ...avatarImages])
              Semantics(
                selected: _avatar == id,
                button: true,
                label: id == 'letter' ? context.t('avatar.letter') : context.t('avatar.picture', {'n': avatarImages.indexOf(id) + 1}),
                child: Pressable(
                  onTap: () => setState(() => _avatar = id),
                  child: AnimatedContainer(
                    duration: Motion.of(context, Motion.fast),
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: _avatar == id ? c.accent : Colors.transparent, width: 2.5)),
                    child: AvatarArt(id: id, name: _avatarName, tint: _tint, size: 48),
                  ),
                ),
              ),
          ]),
          AnimatedSize(
            duration: Motion.of(context, Motion.medium),
            curve: Motion.emphasized,
            child: avatarImages.contains(_avatar)
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Row(children: [
                      Text(context.t('avatar.colour'), style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(width: 12),
                      for (final tn in avatarTints)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Pressable(
                            semanticLabel: context.t('avatar.tint.$tn'),
                            onTap: () => setState(() => _tint = tn),
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(shape: BoxShape.circle, color: tintColor(c, tn)),
                              child: AnimatedScale(
                                scale: _tint == tn ? 1 : 0,
                                duration: Motion.of(context, Motion.medium),
                                curve: Curves.elasticOut,
                                child: const Icon(LucideIcons.check, size: 16, color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                    ]),
                  ),
          ),
          Padding(padding: const EdgeInsets.only(top: 8, bottom: 20), child: Text(context.t('avatar.hint'), style: Theme.of(context).textTheme.bodySmall)),
          field(_name, context.t('app.profile.name'), autofill: const [AutofillHints.name]),
          field(_pen, context.t('app.profile.penName'), hint: context.t('app.profile.penNameHint')),
          field(_username, context.t('app.profile.username'), hint: context.t('app.profile.usernameRule')),
          field(_location, context.t('app.profile.location'), hint: 'ഉദാ: തൃശ്ശൂർ'),
          field(_bio, context.t('app.profile.about'), lines: 6, max: 600),
          field(_website, context.t('app.profile.website'), type: TextInputType.url),
          field(_goal, context.t('app.profile.dailyGoal'), type: TextInputType.number),
          const SizedBox(height: 4),
          Text(context.t('app.settings.typingDefault'), style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: 'manglish', label: Text(context.t('app.editor.manglish'))),
              ButtonSegment(value: 'malayalam', label: Text(context.t('app.editor.malayalam'))),
              ButtonSegment(value: 'english', label: Text(context.t('app.editor.english'))),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          AnimatedSize(
            duration: Motion.of(context, Motion.medium),
            child: _error == null
                ? const SizedBox(width: double.infinity)
                : Container(
                    margin: const EdgeInsets.only(top: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: c.dangerSoft, borderRadius: BorderRadius.circular(10)),
                    child: Text(_error!, style: TextStyle(color: c.danger)),
                  ),
          ),
          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 18),
          Text(context.t('app.settings.account'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(context.t('app.profile.signedInAs', {'email': email ?? ''}), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
          const SizedBox(height: 14),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(labelText: context.t('app.profile.newPassword')),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(onPressed: _password.text.length >= 8 ? _changePassword : null, child: Text(context.t('app.profile.changePassword'))),
          ),
          if (_passwordNote != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_passwordNote!, style: TextStyle(color: c.muted))),
        ],
      ),
    );
  }
}
