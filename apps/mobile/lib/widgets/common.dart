import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app/providers.dart';
import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';

/// A skeleton shape with the shimmer (shaped like the content that is coming).
class Bone extends StatelessWidget {
  const Bone({super.key, this.width, this.height = 12, this.radius = 6});
  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(width: width, height: height, decoration: BoxDecoration(color: context.c.subtle, borderRadius: BorderRadius.circular(radius)));
}

class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Shimmer(
      base: c.subtle,
      glow: c.surface,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(LitmaRadius.lg), border: Border.all(color: c.line)),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Bone(width: 56, height: 10),
            SizedBox(height: 12),
            Bone(width: 170, height: 18),
            SizedBox(height: 14),
            Bone(height: 10),
            SizedBox(height: 8),
            Bone(height: 10),
            SizedBox(height: 8),
            Bone(width: 140, height: 10),
          ],
        ),
      ),
    );
  }
}

/// Small pill while offline, while waiting changes are sent, and briefly when all have synced.
class OfflinePill extends ConsumerStatefulWidget {
  const OfflinePill({super.key});

  @override
  ConsumerState<OfflinePill> createState() => _OfflinePillState();
}

class _OfflinePillState extends ConsumerState<OfflinePill> {
  bool _hadPending = false;
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(syncStateProvider).value;
    ref.listen(syncStateProvider, (_, next) {
      final v = next.value;
      if (v == null) return;
      if (v.pending > 0) {
        _hadPending = true;
      } else if (_hadPending && !v.offline) {
        _hadPending = false;
        setState(() => _done = true);
        Future.delayed(const Duration(seconds: 3), () {
          if (mounted) setState(() => _done = false);
        });
      }
    });
    final c = context.c;
    Widget? pill;
    if (s != null && s.offline) {
      pill = _pill(
        key: const ValueKey('off'),
        icon: Icon(LucideIcons.cloudOff, size: 15, color: c.highlight),
        text: s.pending > 0 ? '${context.t('offline.offline')} ${context.t('offline.pending', {'count': s.pending})}' : context.t('offline.offline'),
      );
    } else if (s != null && s.pending > 0 && s.syncing) {
      pill = _pill(key: const ValueKey('sync'), icon: SizedBox.square(dimension: 13, child: CircularProgressIndicator(strokeWidth: 2, color: c.accent)), text: context.t('offline.syncing'));
    } else if (_done) {
      pill = _pill(key: const ValueKey('done'), icon: Icon(LucideIcons.check, size: 15, color: c.accent), text: context.t('offline.synced'));
    }
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.medium),
      switchInCurve: Motion.emphasizedDecelerate,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, a) => FadeTransition(
        opacity: a,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.6), end: Offset.zero).animate(a), child: child),
      ),
      child: pill ?? const SizedBox.shrink(key: ValueKey('none')),
    );
  }

  Widget _pill({required Key key, required Widget icon, required String text}) {
    final c = context.c;
    return Semantics(
      key: key,
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: c.line),
          boxShadow: const [BoxShadow(color: Color(0x24111113), blurRadius: 24, offset: Offset(0, 8))],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          icon,
          const SizedBox(width: 8),
          Flexible(child: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelMedium)),
        ]),
      ),
    );
  }
}

/// The writer's first letter in a soft tint circle (the web's letter avatar).
class LetterAvatar extends StatelessWidget {
  const LetterAvatar({super.key, required this.name, this.size = 36});
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tints = [c.tintViolet, c.tintCoral, c.tintSky, c.tintLime, c.tintTangerine];
    final tint = tints[name.codeUnits.fold<int>(0, (a, b) => a + b) % tints.length];
    final letter = name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, color: tint.withValues(alpha: 0.16)),
      child: Text(letter, style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: size * 0.46, color: tint, height: 1)),
    );
  }
}

/// Confirmation dialog with Litma's wording and a danger style for destructive actions.
Future<bool> confirm(BuildContext context, {required String title, String? body, required String action, bool danger = false}) async {
  final c = context.c;
  final r = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: body == null ? null : Text(body),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), style: TextButton.styleFrom(foregroundColor: c.ink), child: Text(context.t('common.cancel'))),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          style: danger ? FilledButton.styleFrom(backgroundColor: c.danger, foregroundColor: c.dangerInk) : null,
          child: Text(action),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// "just now", "5 min ago", "3 h ago", else the date.
String relativeTime(BuildContext context, DateTime at) {
  final d = DateTime.now().difference(at);
  if (d.inMinutes < 1) return context.t('common.justNow');
  if (d.inMinutes < 60) return context.t('common.minAgo', {'n': d.inMinutes});
  if (d.inHours < 24) return context.t('common.hoursAgo', {'n': d.inHours});
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final l = at.toLocal();
  return l.year == DateTime.now().year ? '${l.day} ${months[l.month - 1]}' : '${l.day} ${months[l.month - 1]} ${l.year}';
}

/// Tabs as a segmented track with a pill that slides between them (desk, dictionary, Story World).
class SegmentTabs extends StatelessWidget {
  const SegmentTabs({super.key, required this.labels, required this.index, required this.onChanged, this.scrollable = false});
  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  /// Many tabs: scroll sideways with a moving underline-pill instead of equal widths.
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (scrollable) {
      return SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: labels.length,
          separatorBuilder: (_, _) => const SizedBox(width: 6),
          itemBuilder: (context, i) => Pressable(
            onTap: () => i == index ? null : onChanged(i),
            child: AnimatedContainer(
              duration: Motion.of(context, Motion.medium),
              curve: Motion.emphasized,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: i == index ? c.primary : c.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: i == index ? c.primary : c.line)),
              child: Text(labels[i], style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 13.5, fontWeight: FontWeight.w600, color: i == index ? c.primaryInk : c.ink)),
            ),
          ),
        ),
      );
    }
    return Container(
      height: 42,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.subtle, borderRadius: BorderRadius.circular(12)),
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / labels.length;
        return Stack(children: [
          AnimatedPositioned(
            duration: Motion.of(context, Motion.medium),
            curve: Motion.emphasized,
            left: index * w,
            width: w,
            top: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: context.isDark ? Color.lerp(c.subtle, c.ink, 0.12) : c.surface,
                borderRadius: BorderRadius.circular(9),
                boxShadow: const [BoxShadow(color: Color(0x14111113), blurRadius: 6, offset: Offset(0, 1))],
              ),
            ),
          ),
          Row(children: [
            for (var i = 0; i < labels.length; i++)
              Expanded(
                child: Semantics(
                  selected: i == index,
                  button: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      if (i == index) return;
                      Haptics.tap();
                      onChanged(i);
                    },
                    child: Center(
                      child: AnimatedDefaultTextStyle(
                        duration: Motion.of(context, Motion.fast),
                        style: TextStyle(fontFamily: LitmaFonts.ui, fontFamilyFallback: LitmaFonts.uiFallback, fontSize: 14, fontWeight: FontWeight.w600, color: i == index ? c.ink : c.muted),
                        child: Text(labels[i], maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}
