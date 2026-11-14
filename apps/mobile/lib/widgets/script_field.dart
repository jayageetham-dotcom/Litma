import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/keyboard.dart';
import '../core/manglish.dart';
import '../core/motion.dart';
import '../core/theme.dart';

/// A field that takes Manglish, Malayalam or English, like the web's ScriptField: in മലയാളം mode
/// each word turns into Malayalam as it is finished (space, punctuation, done or leaving the
/// field); Malayalam from a system keyboard passes through. "As typed" leaves anything as it is.
/// The choice is remembered per field on this phone. Only text typed in this visit is converted
/// when leaving, so moving through the fields never rewrites a name.
class ScriptField extends ConsumerStatefulWidget {
  const ScriptField({super.key, required this.label, required this.value, required this.onChanged, required this.storageKey, this.plainByDefault = false, this.autofocus = false, this.onSubmitted});
  final bool autofocus;

  /// Done on the keyboard, after the last word has been converted.
  final VoidCallback? onSubmitted;
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final String storageKey;
  final bool plainByDefault;

  @override
  ConsumerState<ScriptField> createState() => _ScriptFieldState();
}

class _ScriptFieldState extends ConsumerState<ScriptField> {
  late final _text = TextEditingController(text: widget.value);
  final _focus = FocusNode();
  late bool _manglish;
  bool _dirty = false;

  /// The text when the writer came into the field: Esc (hardware keyboard) puts it back.
  String? _before;

  static final _finished = RegExp(r'([A-Za-z~_^]+)([^A-Za-z~_^])$');
  static final _latin = RegExp('[A-Za-z]');

  String get _key => 'litma:fieldMode:${widget.storageKey}';

  @override
  void initState() {
    super.initState();
    final saved = ref.read(servicesProvider).prefs.getString(_key);
    _manglish = saved == null ? !widget.plainByDefault : saved == 'manglish';
    _focus.addListener(() {
      if (_focus.hasFocus) {
        _before ??= _text.text;
      } else {
        _finishAll();
        _before = null;
      }
    });
  }

  @override
  void didUpdateWidget(ScriptField old) {
    super.didUpdateWidget(old);
    // a change from outside (sample values, another device) while the writer isn't typing here
    if (!_focus.hasFocus && widget.value != _text.text) _text.text = widget.value;
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _pick(bool manglish) {
    setState(() => _manglish = manglish);
    ref.read(servicesProvider).prefs.setString(_key, manglish ? 'manglish' : 'plain');
  }

  void _set(String text, int caret) {
    _text.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: caret.clamp(0, text.length)));
    widget.onChanged(text);
  }

  void _changed(String v) {
    _dirty = true;
    final sel = _text.selection;
    final pos = sel.isValid ? sel.extentOffset : v.length;
    if (_manglish && _text.value.composing.isCollapsed) {
      // a Latin word just finished by a space or punctuation mark before the caret
      final m = _finished.firstMatch(v.substring(0, pos));
      if (m != null) {
        final ml = toMalayalam(m[1]!);
        final start = pos - m[0]!.length;
        _set(v.substring(0, start) + ml + m[2]! + v.substring(pos), start + ml.length + m[2]!.length);
        return;
      }
    }
    widget.onChanged(v);
    setState(() {});
  }

  /// The × button: empties the field and keeps the keyboard up for the new text.
  void _clear() {
    _before ??= _text.text;
    _dirty = false;
    _set('', 0);
    setState(() {});
    _focus.requestFocus();
  }

  /// Esc: back to the text from before this visit to the field.
  KeyEventResult _escape(FocusNode _, KeyEvent e) {
    final before = _before;
    if (e is! KeyDownEvent || e.logicalKey != LogicalKeyboardKey.escape || before == null || before == _text.text) return KeyEventResult.ignored;
    _dirty = false;
    _set(before, before.length);
    setState(() {});
    return KeyEventResult.handled;
  }

  void _finishAll() {
    if (_dirty && _manglish && _latin.hasMatch(_text.text)) _set(toMalayalam(_text.text), toMalayalam(_text.text).length);
    _dirty = false;
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final latin = _manglish && _latin.hasMatch(_text.text);
    Widget mode(String label, bool on, VoidCallback tap) => Pressable(
          onTap: tap,
          semanticLabel: label,
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.fast),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            color: on ? c.accentSoft : Colors.transparent,
            child: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: on ? FontWeight.w600 : FontWeight.w400, color: on ? c.accent : c.muted)),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text(widget.label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: c.muted))),
        Semantics(
          label: context.t('field.typing'),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: c.line)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              mode(context.t('field.manglish'), _manglish, () => _pick(true)),
              mode(context.t('field.plain'), !_manglish, () => _pick(false)),
            ]),
          ),
        ),
      ]),
      const SizedBox(height: 4),
      Focus(
        canRequestFocus: false,
        skipTraversal: true,
        onKeyEvent: _escape,
        child: TextField(
        controller: _text,
        focusNode: _focus,
        autofocus: widget.autofocus,
        textInputAction: widget.onSubmitted == null ? null : TextInputAction.done,
        onTapOutside: dismissKeyboard,
        autocorrect: !_manglish,
        enableSuggestions: !_manglish,
        style: const TextStyle(fontFamily: LitmaFonts.sans, fontFamilyFallback: ['Inter']),
        decoration: InputDecoration(
          isDense: true,
          suffixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 36),
          suffixIcon: _text.text.isEmpty
              ? null
              : IconButton(
                  icon: Icon(LucideIcons.x, size: 16, color: c.muted),
                  tooltip: context.t('field.clear'),
                  visualDensity: VisualDensity.compact,
                  onPressed: _clear,
                ),
        ),
        onChanged: _changed,
        onSubmitted: (_) {
          _finishAll();
          widget.onSubmitted?.call();
        },
      ),
      ),
      if (latin)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4), minimumSize: const Size(0, 30), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            onPressed: () => _set(toMalayalam(_text.text), toMalayalam(_text.text).length),
            child: Text('→ ${toMalayalam(_text.text)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: LitmaFonts.sans, fontSize: 12, color: c.muted)),
          ),
        ),
    ]);
  }
}
