import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/manglish.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../widgets/brand.dart';
import 'auth_screen.dart';

/// First screen for visitors: the wordmark, what Litma is, and a live Manglish demo.
/// Like the website's public pages it is always light and uses the colourful landing palette.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: litmaTheme(Brightness.light),
      child: Builder(builder: (context) {
        final c = context.c;
        return Scaffold(
          body: ColourField(
            child: SafeArea(
              child: LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const FadeSlideIn(child: Align(alignment: Alignment.centerLeft, child: Wordmark(size: 52))),
                              const SizedBox(height: 18),
                              FadeSlideIn(
                                index: 1,
                                child: Text(
                                  context.t('app.welcome.tagline'),
                                  style: TextStyle(fontFamily: LitmaFonts.display, fontSize: 21, height: 1.4, fontWeight: FontWeight.w600, color: c.night),
                                ),
                              ),
                              const SizedBox(height: 28),
                              const FadeSlideIn(index: 2, child: _TypingDemo()),
                              const SizedBox(height: 32),
                              FadeSlideIn(
                                index: 3,
                                child: FilledButton(
                                  style: FilledButton.styleFrom(backgroundColor: c.night, shape: const StadiumBorder(), minimumSize: const Size.fromHeight(54)),
                                  onPressed: () => Navigator.of(context).push(AuthScreen.route(signUp: true)),
                                  child: Text(context.t('app.welcome.create')),
                                ),
                              ),
                              const SizedBox(height: 12),
                              FadeSlideIn(
                                index: 4,
                                child: OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    shape: const StadiumBorder(),
                                    minimumSize: const Size.fromHeight(54),
                                    backgroundColor: c.surface.withValues(alpha: 0.7),
                                    side: BorderSide(color: c.night.withValues(alpha: 0.25)),
                                  ),
                                  onPressed: () => Navigator.of(context).push(AuthScreen.route(signUp: false)),
                                  child: Text(context.t('app.welcome.signIn')),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

/// A small page that types Manglish and turns each word into Malayalam, over and over
/// (the home page's TryManglish, as a native animation).
class _TypingDemo extends StatefulWidget {
  const _TypingDemo();

  @override
  State<_TypingDemo> createState() => _TypingDemoState();
}

class _TypingDemoState extends State<_TypingDemo> {
  static const _lines = ['ente naadu', 'mazha peyyunnu', 'oru kadha parayaam'];
  int _line = 0;
  String _done = '';
  String _typing = '';
  Timer? _timer;
  bool _cursor = true;
  Timer? _blink;

  @override
  void initState() {
    super.initState();
    _blink = Timer.periodic(const Duration(milliseconds: 530), (_) => setState(() => _cursor = !_cursor));
    _next();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _timer?.cancel();
      _done = manglish(_lines.first);
      _typing = '';
    }
  }

  void _next() {
    final words = _lines[_line].split(' ');
    var w = 0, ch = 0;
    _timer = Timer.periodic(const Duration(milliseconds: 95), (t) {
      if (!mounted) return t.cancel();
      setState(() {
        if (w >= words.length) {
          t.cancel();
          Future.delayed(const Duration(milliseconds: 1600), () {
            if (!mounted) return;
            setState(() {
              _line = (_line + 1) % _lines.length;
              _done = '';
              _typing = '';
            });
            _next();
          });
          return;
        }
        final word = words[w];
        if (ch < word.length) {
          _typing = word.substring(0, ++ch);
        } else {
          _done = '$_done${manglishWord(word)} ';
          _typing = '';
          w++;
          ch = 0;
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _blink?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Transform.rotate(
      angle: -0.012,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [BoxShadow(color: c.night.withValues(alpha: 0.16), blurRadius: 40, offset: const Offset(0, 18))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            for (final col in [c.coral, c.tangerine, c.lime]) Container(width: 9, height: 9, margin: const EdgeInsets.only(right: 6), decoration: BoxDecoration(shape: BoxShape.circle, color: col)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(6)),
              child: Text('Manglish → മലയാളം', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c.violetText, fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback)),
            ),
          ]),
          const SizedBox(height: 14),
          SizedBox(
            height: 64,
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: _done, style: TextStyle(color: c.ink)),
                TextSpan(text: _typing, style: TextStyle(color: c.accent, decoration: TextDecoration.underline, decorationColor: c.accent.withValues(alpha: 0.4))),
                TextSpan(text: _cursor ? '|' : ' ', style: TextStyle(color: c.accent, fontWeight: FontWeight.w300)),
              ]),
              style: const TextStyle(fontFamily: LitmaFonts.serif, fontSize: 22, height: 1.45),
            ),
          ),
        ]),
      ),
    );
  }
}
