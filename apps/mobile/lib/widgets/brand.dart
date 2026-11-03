import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../core/motion.dart';
import '../core/theme.dart';

/// The Litma wordmark: ലിറ്റ്മ in solid ink with the violet dot (the web's .brand-text).
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.size = 24, this.color, this.dot});
  final double size;
  final Color? color;
  final Color? dot;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: 'ലിറ്റ്മ', style: TextStyle(color: color ?? c.brand)),
        TextSpan(text: '.', style: TextStyle(color: dot ?? c.brandMark)),
      ]),
      style: TextStyle(fontFamily: LitmaFonts.display, fontSize: size, fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -0.2),
      semanticsLabel: 'Litma',
    );
  }
}

/// Full-screen loading: a pen nib writing a line under ലിറ്റ്മ (the web's InkLoader).
class InkLoader extends StatefulWidget {
  const InkLoader({super.key, this.label});
  final String? label;

  @override
  State<InkLoader> createState() => _InkLoaderState();
}

class _InkLoaderState extends State<InkLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ColoredBox(
      color: c.canvas,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Wordmark(size: 40),
            const SizedBox(height: 6),
            SizedBox(
              width: 120,
              height: 22,
              child: AnimatedBuilder(animation: _c, builder: (context, _) => CustomPaint(painter: _InkLine(_c.value, c.accent, c.ink))),
            ),
            if (widget.label != null) ...[
              const SizedBox(height: 14),
              Text(widget.label!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class _InkLine extends CustomPainter {
  _InkLine(this.t, this.ink, this.nib);
  final double t;
  final Color ink;
  final Color nib;

  @override
  void paint(Canvas canvas, Size size) {
    // write the line during the first 70%, then let it fade before the next stroke
    final draw = Curves.easeInOutCubic.transform((t / 0.7).clamp(0.0, 1.0));
    final fade = t < 0.7 ? 1.0 : 1 - Curves.easeIn.transform((t - 0.7) / 0.3);
    final path = Path();
    final y = size.height * 0.45;
    path.moveTo(4, y);
    for (var x = 4.0; x <= size.width - 4; x += 2) {
      path.lineTo(x, y + math.sin((x / size.width) * math.pi * 2.2) * 3.2);
    }
    final metric = path.computeMetrics().first;
    final len = metric.length * draw;
    final partial = metric.extractPath(0, len);
    final paint = Paint()
      ..color = ink.withValues(alpha: fade)
      ..strokeWidth = 2.6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(partial, paint);
    if (t < 0.7) {
      final tan = metric.getTangentForOffset(len);
      if (tan != null) _nib(canvas, tan.position);
    }
  }

  void _nib(Canvas canvas, Offset at) {
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(-0.75);
    final p = Path()
      ..moveTo(0, 0)
      ..lineTo(-3.4, -9)
      ..quadraticBezierTo(0, -12.5, 3.4, -9)
      ..close();
    canvas.drawPath(p, Paint()..color = nib);
    canvas.drawCircle(const Offset(0, -7.4), 1.1, Paint()..color = Colors.white);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_InkLine old) => old.t != t || old.ink != ink;
}

/// Soft colour fields behind the welcome screen (the home page's ColourField, as radial
/// gradients: cheap to draw and smooth on phones).
class ColourField extends StatelessWidget {
  const ColourField({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return CustomPaint(
      painter: _Field([
        (const Alignment(-1.1, -0.9), c.violet.withValues(alpha: 0.22), 0.9),
        (const Alignment(1.15, -0.55), c.sky.withValues(alpha: 0.20), 0.75),
        (const Alignment(-0.9, 0.9), c.lime.withValues(alpha: 0.22), 0.8),
        (const Alignment(1.0, 1.05), c.coral.withValues(alpha: 0.16), 0.7),
      ], c.mist),
      child: child,
    );
  }
}

class _Field extends CustomPainter {
  _Field(this.spots, this.base);
  final List<(Alignment, Color, double)> spots;
  final Color base;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = base);
    final r = math.max(size.width, size.height);
    for (final (a, color, scale) in spots) {
      final center = a.alongSize(size);
      final shader = ui.Gradient.radial(center, r * scale * 0.7, [color, color.withValues(alpha: 0)]);
      canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
    }
  }

  @override
  bool shouldRepaint(_Field old) => old.base != base;
}
