import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One motion system for the whole app: the same few durations and curves everywhere, so
/// transitions feel related. Everything respects the system "reduce motion" setting.
abstract final class Motion {
  static const instant = Duration(milliseconds: 90);
  static const fast = Duration(milliseconds: 160);
  static const medium = Duration(milliseconds: 280);
  static const slow = Duration(milliseconds: 420);
  static const page = Duration(milliseconds: 460);

  /// Material 3 "emphasized": quick start, long gentle settle. For things entering.
  static const emphasized = Cubic(0.2, 0.0, 0.0, 1.0);
  static const emphasizedDecelerate = Cubic(0.05, 0.7, 0.1, 1.0);
  static const emphasizedAccelerate = Cubic(0.3, 0.0, 0.8, 0.15);

  /// The web's pop-in curve (globals.css .pop-in), for small things appearing.
  static const pop = Cubic(0.2, 0.8, 0.2, 1.0);
  static const standard = Curves.easeInOutCubic;

  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// [d], or nothing when the writer asked for less motion.
  static Duration of(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;
}

/// Light haptic taps for key moments (never on every keystroke).
abstract final class Haptics {
  static void tap() => HapticFeedback.selectionClick();
  static void soft() => HapticFeedback.lightImpact();
  static void confirm() => HapticFeedback.mediumImpact();
}

/// Shrinks slightly while pressed and springs back: the tactile feel of cards and buttons.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = 0.97, this.haptic = true, this.semanticLabel});
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;
  final String? semanticLabel;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return Semantics(
      button: enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled ? (_) => _set(true) : null,
        onTapUp: enabled ? (_) => _set(false) : null,
        onTapCancel: () => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                if (widget.haptic) Haptics.tap();
                widget.onTap!();
              },
        onLongPress: widget.onLongPress == null
            ? null
            : () {
                _set(false);
                Haptics.confirm();
                widget.onLongPress!();
              },
        child: AnimatedScale(
          scale: _down ? widget.scale : 1,
          duration: _down ? Motion.instant : Motion.medium,
          curve: _down ? Curves.easeOut : Curves.elasticOut,
          child: widget.child,
        ),
      ),
    );
  }
}

/// Fades and rises into place, after [index] × [step] (lists enter one item after another).
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({super.key, required this.child, this.index = 0, this.step = const Duration(milliseconds: 45), this.offset = 14, this.duration = Motion.slow});
  final Widget child;
  final int index;
  final Duration step;
  final double offset;
  final Duration duration;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _a = CurvedAnimation(parent: _c, curve: Motion.emphasizedDecelerate);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
    final delay = widget.step * math.min(widget.index, 12);
    Future.delayed(delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _a,
        child: widget.child,
        builder: (context, child) => Opacity(
          opacity: _a.value,
          child: Transform.translate(offset: Offset(0, (1 - _a.value) * widget.offset), child: child),
        ),
      );
}

/// A soft light band sweeping across skeleton shapes (the web's .skeleton shimmer).
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child, required this.base, required this.glow});
  final Widget child;
  final Color base;
  final Color glow;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!Motion.reduced(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (rect) {
            final x = _c.value * 2.6 - 0.8;
            return LinearGradient(
              begin: Alignment(x - 1, -0.2),
              end: Alignment(x + 1, 0.2),
              colors: [widget.base, widget.glow, widget.base],
              stops: const [0.25, 0.5, 0.75],
            ).createShader(rect);
          },
          child: child,
        ),
      );
}

/// Swaps children with a fade and a small scale (status lines, icons that change meaning).
class SwapFade extends StatelessWidget {
  const SwapFade({super.key, required this.child, this.duration = Motion.medium, this.alignment = Alignment.centerLeft});
  final Widget child;
  final Duration duration;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
        duration: Motion.of(context, duration),
        switchInCurve: Motion.pop,
        switchOutCurve: Curves.easeIn,
        layoutBuilder: (current, previous) => Stack(alignment: alignment, children: [...previous, ?current]),
        transitionBuilder: (child, a) => FadeTransition(
          opacity: a,
          child: ScaleTransition(scale: Tween(begin: 0.92, end: 1.0).animate(a), alignment: alignment, child: child),
        ),
        child: child,
      );
}
