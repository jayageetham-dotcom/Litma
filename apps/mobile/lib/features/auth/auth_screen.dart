import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app/providers.dart';
import '../../core/i18n.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../data/auth.dart';
import '../../widgets/brand.dart';
import '../../core/keyboard.dart';
import '../../data/analytics.dart';

/// Sign in / Create account: one screen that morphs between the two, the form card on a stack of
/// violet and lime sheets (the web's AuthShell). Always light, like the website's public pages.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, required this.signUp});
  final bool signUp;

  static Route<void> route({required bool signUp}) => PageRouteBuilder(
        transitionDuration: Motion.page,
        reverseTransitionDuration: Motion.slow,
        pageBuilder: (_, _, _) => AuthScreen(signUp: signUp),
        transitionsBuilder: (context, a, _, child) {
          final curved = CurvedAnimation(parent: a, curve: Motion.emphasizedDecelerate, reverseCurve: Motion.emphasizedAccelerate);
          return FadeTransition(
            opacity: curved,
            child: SlideTransition(position: Tween(begin: const Offset(0, 0.08), end: Offset.zero).animate(curved), child: child),
          );
        },
      );

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  late bool _signUp = widget.signUp;

  @override
  void initState() {
    super.initState();
    Analytics.screen(widget.signUp ? '/signup/' : '/login/');
  }
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _busy = false;
  String? _error;
  String? _notice;

  AuthGateway get _auth => ref.read(servicesProvider).auth;

  Future<void> _run(Future<void> Function() f) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f();
    } catch (e) {
      final m = authMessage(e);
      if (mounted && m.isNotEmpty) setState(() => _error = m);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    // read the fields when pressed, so values filled in by password autofill always count
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty) return setState(() => _error = context.t('app.auth.emailMissing'));
    if (password.isEmpty) return setState(() => _error = context.t('app.auth.passwordMissing'));
    await _run(() async {
      if (_signUp) {
        final confirmFirst = await _auth.signUp(email, password, name: _name.text);
        if (confirmFirst && mounted) {
          setState(() {
            _notice = context.t('app.auth.confirmSent');
            _signUp = false;
          });
        }
      } else {
        await _auth.signIn(email, password);
      }
    });
    if (_auth.writer != null && mounted) Navigator.of(context).popUntil((r) => r.isFirst);
  }

  Future<void> _forgot() async {
    final ctrl = TextEditingController(text: _email.text);
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(24, 0, 24, 24 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(context.t('app.auth.resetTitle'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(context.t('app.auth.resetBody'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.c.muted)),
          const SizedBox(height: 16),
          TextField(onTapOutside: dismissKeyboard, controller: ctrl, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: InputDecoration(labelText: context.t('app.auth.email'))),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              try {
                await _auth.resetPassword(ctrl.text);
                if (context.mounted) Navigator.pop(context, true);
              } catch (_) {
                if (context.mounted) Navigator.pop(context, false);
              }
            },
            child: Text(context.t('app.auth.resetSend')),
          ),
        ]),
      ),
    );
    if (sent == true && mounted) setState(() => _notice = context.t('app.auth.resetSent'));
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: litmaTheme(Brightness.light),
      child: Builder(builder: (context) {
        final c = context.c;
        return Scaffold(
          backgroundColor: c.mist,
          appBar: AppBar(backgroundColor: Colors.transparent, title: const Wordmark(size: 22)),
          extendBodyBehindAppBar: true,
          body: ColourField(
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: _SheetStack(child: AutofillGroup(child: _form(context))),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _form(BuildContext context) {
    final c = context.c;
    final auth = _auth;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SwapFade(
        child: Column(
          key: ValueKey(_signUp),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(context.t(_signUp ? 'app.auth.signUpTitle' : 'app.auth.signInTitle'), style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(context.t(_signUp ? 'app.auth.signUpBody' : 'app.auth.signInBody'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.muted)),
          ],
        ),
      ),
      const SizedBox(height: 20),
      _ProviderButton(
        label: context.t('app.auth.google'),
        icon: const _GoogleG(),
        onTap: _busy ? null : () => _run(auth.signInWithGoogle),
      ),
      if (auth.appleAvailable) ...[
        const SizedBox(height: 10),
        _ProviderButton(label: context.t('app.auth.apple'), icon: const _AppleMark(), dark: true, onTap: _busy ? null : () => _run(auth.signInWithApple)),
      ],
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(children: [
          Expanded(child: Divider(color: c.line)),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(context.t('app.auth.or'), style: Theme.of(context).textTheme.labelSmall)),
          Expanded(child: Divider(color: c.line)),
        ]),
      ),
      AnimatedSize(
        duration: Motion.of(context, Motion.medium),
        curve: Motion.emphasized,
        child: _signUp
            ? Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(onTapOutside: dismissKeyboard, controller: _name, textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.name], decoration: InputDecoration(labelText: context.t('app.auth.name'))),
              )
            : const SizedBox(width: double.infinity),
      ),
      TextField(onTapOutside: dismissKeyboard, 
        controller: _email,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        autocorrect: false,
        autofillHints: const [AutofillHints.email],
        decoration: InputDecoration(labelText: context.t('app.auth.email')),
      ),
      const SizedBox(height: 12),
      TextField(onTapOutside: dismissKeyboard, 
        controller: _password,
        obscureText: !_show,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _submit(),
        autofillHints: [_signUp ? AutofillHints.newPassword : AutofillHints.password],
        decoration: InputDecoration(
          labelText: context.t('app.auth.password'),
          suffixIcon: IconButton(
            tooltip: context.t(_show ? 'app.auth.hidePassword' : 'app.auth.showPassword'),
            onPressed: () => setState(() => _show = !_show),
            icon: SwapFade(alignment: Alignment.center, child: Icon(_show ? LucideIcons.eyeOff : LucideIcons.eye, key: ValueKey(_show), size: 20, color: c.muted)),
          ),
        ),
      ),
      if (!_signUp)
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: _forgot, child: Text(context.t('app.auth.forgot'))),
        )
      else
        const SizedBox(height: 12),
      AnimatedSize(
        duration: Motion.of(context, Motion.medium),
        curve: Motion.emphasized,
        child: _error != null || _notice != null
            ? Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: _error != null ? c.dangerSoft : c.accentSoft, borderRadius: BorderRadius.circular(10)),
                child: Text(_error ?? _notice!, style: TextStyle(color: _error != null ? c.danger : c.optionSelectedInk, fontSize: 14, height: 1.4)),
              )
            : const SizedBox(width: double.infinity),
      ),
      FilledButton(
        onPressed: _busy ? null : _submit,
        style: FilledButton.styleFrom(shape: const StadiumBorder(), minimumSize: const Size.fromHeight(52), backgroundColor: c.night, disabledBackgroundColor: c.night.withValues(alpha: 0.85)),
        child: SwapFade(
          alignment: Alignment.center,
          child: _busy
              ? SizedBox.square(key: const ValueKey('busy'), dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: c.primaryInk))
              : Text(context.t(_signUp ? 'app.auth.signUp' : 'app.auth.signIn'), key: ValueKey(_signUp), style: TextStyle(color: c.primaryInk)),
        ),
      ),
      const SizedBox(height: 8),
      TextButton(
        onPressed: () => setState(() {
          _signUp = !_signUp;
          _error = null;
        }),
        child: SwapFade(alignment: Alignment.center, child: Text(context.t(_signUp ? 'app.auth.haveAccount' : 'app.auth.noAccount'), key: ValueKey(_signUp))),
      ),
    ]);
  }
}

/// The form card on a stack of tilted violet and lime sheets.
class _SheetStack extends StatelessWidget {
  const _SheetStack({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget sheet(Color color, double angle, Offset offset) => Positioned.fill(
          child: Transform.translate(offset: offset, child: Transform.rotate(angle: angle, child: DecoratedBox(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(28))))),
        );
    return Stack(clipBehavior: Clip.none, children: [
      sheet(c.lime.withValues(alpha: 0.85), 0.05, const Offset(10, 14)),
      sheet(c.violet.withValues(alpha: 0.9), -0.035, const Offset(-8, 8)),
      Container(
        padding: const EdgeInsets.fromLTRB(22, 26, 22, 14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(26),
          boxShadow: [BoxShadow(color: c.night.withValues(alpha: 0.18), blurRadius: 40, offset: const Offset(0, 16))],
        ),
        child: child,
      ),
    ]);
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({required this.label, required this.icon, required this.onTap, this.dark = false});
  final String label;
  final Widget icon;
  final VoidCallback? onTap;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        shape: const StadiumBorder(),
        minimumSize: const Size.fromHeight(50),
        backgroundColor: dark ? Colors.black : c.surface,
        foregroundColor: dark ? Colors.white : c.ink,
        side: BorderSide(color: dark ? Colors.black : c.lineStrong),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [icon, const SizedBox(width: 10), Text(label)]),
    );
  }
}

/// Google's "G": the same SVG the web's GoogleButton uses (never redrawn).
class _GoogleG extends StatelessWidget {
  const _GoogleG();
  static const _svg =
      '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  @override
  Widget build(BuildContext context) => SvgPicture.string(_svg, width: 18, height: 18);
}

/// Apple's mark from apps/web/public/brands (only Apple's may switch to white on a dark button).
class _AppleMark extends StatelessWidget {
  const _AppleMark();
  @override
  Widget build(BuildContext context) =>
      SvgPicture.asset('assets/brands/apple.svg', width: 17, height: 20, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn));
}
