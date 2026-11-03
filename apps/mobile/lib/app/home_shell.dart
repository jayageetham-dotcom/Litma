import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../features/desk/desk_screen.dart';
import '../features/dictionary/dictionary_screen.dart';
import '../features/profile/profile_screen.dart';

/// Signed-in home: Desk · Dictionary · Me in a bottom tab bar (the web's MobileNav), fading through
/// between them. Each tab keeps its place when you come back to it.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with SingleTickerProviderStateMixin {
  int _index = 0;
  final _visited = <int>{0};
  late final _fade = AnimationController(vsync: this, duration: Motion.medium, value: 1);

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final pages = [const DeskScreen(), const DictionaryScreen(), const ProfileScreen()];
    return Scaffold(
      // one stack, never rebuilt, so every tab keeps its place; the new tab fades and rises in
      body: FadeTransition(
        opacity: CurvedAnimation(parent: _fade, curve: Motion.emphasizedDecelerate),
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 0.012), end: Offset.zero).animate(CurvedAnimation(parent: _fade, curve: Motion.emphasizedDecelerate)),
          child: IndexedStack(
            index: _index,
            children: [for (var i = 0; i < pages.length; i++) _visited.contains(i) ? pages[i] : const SizedBox.shrink()],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        height: 64,
        backgroundColor: c.surface,
        indicatorColor: c.optionSelected,
        surfaceTintColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        animationDuration: Motion.medium,
        onDestinationSelected: (i) {
          Haptics.tap();
          if (i == _index) return;
          setState(() {
            _index = i;
            _visited.add(i);
          });
          if (!Motion.reduced(context)) _fade.forward(from: 0);
        },
        destinations: [
          NavigationDestination(icon: const Icon(LucideIcons.layoutGrid), selectedIcon: Icon(LucideIcons.layoutGrid, color: c.optionSelectedInk), label: context.t('nav.desk')),
          NavigationDestination(icon: const Icon(LucideIcons.bookA), selectedIcon: Icon(LucideIcons.bookA, color: c.optionSelectedInk), label: context.t('nav.dictionary')),
          NavigationDestination(icon: const Icon(LucideIcons.user), selectedIcon: Icon(LucideIcons.user, color: c.optionSelectedInk), label: context.t('nav.me')),
        ],
      ),
    );
  }
}
